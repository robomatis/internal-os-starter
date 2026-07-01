"use server";

// ponudbe write paths. Every action: validate → auth.getUser() → userCanAccess re-check
// → work → write the module's PREFIXED, RLS-scoped tables → revalidate → redirect with
// ?ok / ?error. External calls (Graph, ZOHO, website, LLM) live in ./lib and all fall
// back to mock data when their env vars are unset, so the whole flow works keyless.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { userCanAccess } from "@/lib/access";
import { AiDailyLimitError, recordAiUsage } from "@/lib/ai-budget";
import { listQuoteRequestEmails } from "./lib/graph";
import { classifyEmail } from "./lib/classify";
import { listProducts, findContactByEmail, createQuote } from "./lib/zoho";
import { buildCatalog } from "./lib/website-catalog";
import { matchAndCompose, type ComposeResult } from "./lib/quote";
import { buildQuotePdf } from "./lib/pdf";

const MODULE = "ponudbe";
const BASE = `/m/${MODULE}`;
const DEFAULT_TAX_RATE = 22; // Slovenian DDV

const UUID = z.string().regex(/^[0-9a-fA-F-]{36}$/, "Neveljaven ID");

function fail(message: string): never {
  redirect(`${BASE}?error=${encodeURIComponent(message)}`);
}

function failDetail(id: string, message: string): never {
  redirect(`${BASE}?id=${id}&error=${encodeURIComponent(message)}`);
}

async function requireAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await userCanAccess(supabase, user.id, MODULE))) {
    fail("Nimaš dostopa do tega modula.");
  }
  return { supabase, user };
}

// Sum the quote's line items and store header totals (net / DDV / skupaj).
async function recomputeTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
) {
  const { data: items } = await supabase
    .from("ponudbe_quote_items")
    .select("net_amount, tax_rate")
    .eq("quote_id", quoteId);
  let net = 0;
  let tax = 0;
  for (const it of items ?? []) {
    const n = Number(it.net_amount) || 0;
    const rate = it.tax_rate === null ? DEFAULT_TAX_RATE : Number(it.tax_rate) || 0;
    net += n;
    tax += (n * rate) / 100;
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  await supabase
    .from("ponudbe_quotes")
    .update({
      net_amount: round(net),
      tax_amount: round(tax),
      total_amount: round(net + tax),
    })
    .eq("id", quoteId);
}

// ---------------------------------------------------------------- sync + classify
export async function syncEmails() {
  const { supabase, user } = await requireAccess();

  let mock = false;
  try {
    const result = await listQuoteRequestEmails();
    mock = result.mock;
    if (result.messages.length) {
      // Idempotent: the unique (user_id, message_id) index means re-sync never dupes.
      const rows = result.messages.map((m) => ({
        user_id: user.id,
        message_id: m.message_id,
        from_email: m.from_email,
        from_name: m.from_name,
        subject: m.subject,
        received_at: m.received_at,
        body_text: m.body_text,
      }));
      const { error } = await supabase
        .from("ponudbe_emails")
        .upsert(rows, { onConflict: "user_id,message_id", ignoreDuplicates: true });
      if (error) fail(`Sinhronizacija ni uspela: ${error.message}`);
    }
  } catch (e) {
    console.error("ponudbe sync failed", e);
    fail("Branje e-pošte ni uspelo. Preveri nastavitve Microsoft Graph.");
  }

  // Classify everything still unclassified (mock = free; real = budget-guarded).
  const { data: pending } = await supabase
    .from("ponudbe_emails")
    .select("id, subject, body_text")
    .eq("classification", "unclassified");

  for (const row of pending ?? []) {
    try {
      await recordAiUsage(supabase, MODULE);
      const c = await classifyEmail({ subject: row.subject, body: row.body_text });
      await supabase
        .from("ponudbe_emails")
        .update({
          classification: c.classification,
          classify_reason: c.reason,
          classify_mock: c.mock,
        })
        .eq("id", row.id);
    } catch (e) {
      if (e instanceof AiDailyLimitError) {
        // Stop classifying for today; what's already done stays. Soft-notify.
        revalidatePath(BASE);
        redirect(`${BASE}?error=${encodeURIComponent("Dnevna AI omejitev dosežena — del e-pošte ostane nerazvrščen.")}`);
      }
      console.error("ponudbe classify failed", e);
      // Leave this row unclassified; continue with the rest.
    }
  }

  revalidatePath(BASE);
  redirect(`${BASE}?ok=${mock ? "mock" : "1"}`);
}

export async function dismissEmail(formData: FormData) {
  const parsed = UUID.safeParse(formData.get("id"));
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const { supabase } = await requireAccess();
  const { error } = await supabase
    .from("ponudbe_emails")
    .update({ status: "dismissed" })
    .eq("id", parsed.data);
  if (error) fail(error.message);
  revalidatePath(BASE);
  redirect(`${BASE}?ok=1`);
}

// ---------------------------------------------------------------- prepare a quote
export async function prepareQuote(formData: FormData) {
  const parsed = UUID.safeParse(formData.get("email_id"));
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const emailId = parsed.data;

  const { supabase, user } = await requireAccess();

  const { data: email } = await supabase
    .from("ponudbe_emails")
    .select("id, from_email, from_name, subject, body_text, classification")
    .eq("id", emailId)
    .maybeSingle();
  if (!email) fail("Sporočilo ni najdeno.");
  if (email.classification !== "quote_request") {
    fail("To sporočilo ni označeno kot povpraševanje.");
  }

  // If a quote already exists for this email, just open it (idempotent).
  const { data: existing } = await supabase
    .from("ponudbe_quotes")
    .select("id")
    .eq("email_id", emailId)
    .maybeSingle();
  if (existing) redirect(`${BASE}?id=${existing.id}`);

  // Build the catalogue (ZOHO products + website copy) and match + compose (LLM).
  let composed: ComposeResult;
  try {
    const { products } = await listProducts();
    const catalog = await buildCatalog(products);
    await recordAiUsage(supabase, MODULE);
    composed = await matchAndCompose({
      email: {
        from_name: email.from_name,
        from_email: email.from_email,
        subject: email.subject,
        body: email.body_text,
      },
      catalog,
    });
  } catch (e) {
    if (e instanceof AiDailyLimitError) {
      fail("Dnevna AI omejitev je dosežena. Poskusi jutri.");
    }
    console.error("ponudbe compose failed", e);
    fail("Priprava ponudbe ni uspela.");
  }

  // Best-effort contact match from ZOHO by sender email.
  const { contact } = await findContactByEmail(email.from_email);

  const fullName = [contact?.first_name, contact?.last_name]
    .filter(Boolean)
    .join(" ");
  const customerName =
    contact?.account_name || fullName || email.from_name || email.from_email;

  const { data: quote, error: qErr } = await supabase
    .from("ponudbe_quotes")
    .insert({
      user_id: user.id,
      email_id: emailId,
      customer_name: customerName,
      customer_email: email.from_email,
      zoho_contact_id: contact?.id ?? null,
      currency: "EUR",
      status: "draft",
      draft_subject: composed.draft_subject,
      draft_body: composed.draft_body,
      compose_mock: composed.mock,
    })
    .select("id")
    .single();
  if (qErr || !quote) fail(qErr?.message ?? "Shranjevanje ponudbe ni uspelo.");

  if (composed.lines.length) {
    const rows = composed.lines.map((l, i) => {
      const qty = l.quantity ?? 1;
      const price = l.unit_price ?? 0;
      return {
        quote_id: quote.id,
        user_id: user.id,
        line_no: i + 1,
        requested_text: l.requested_text,
        sku: l.sku,
        zoho_product_id: l.zoho_product_id,
        product_name: l.product_name,
        description: l.description,
        quantity: qty,
        unit: l.unit,
        unit_price: l.unit_price,
        net_amount: Math.round(qty * price * 100) / 100,
        tax_rate: DEFAULT_TAX_RATE,
        confidence: l.confidence,
      };
    });
    const { error: liErr } = await supabase.from("ponudbe_quote_items").insert(rows);
    if (liErr) console.error("ponudbe line items insert failed", liErr);
  }

  await recomputeTotals(supabase, quote.id);
  await supabase.from("ponudbe_emails").update({ status: "quoted" }).eq("id", emailId);

  revalidatePath(BASE);
  redirect(`${BASE}?id=${quote.id}&ok=1`);
}

// ---------------------------------------------------------------- edit a quote
export async function saveItems(formData: FormData) {
  const parsed = UUID.safeParse(formData.get("quote_id"));
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const quoteId = parsed.data;
  const { supabase } = await requireAccess();

  // Inputs are named name_<id>, qty_<id>, price_<id> — one set per existing line.
  const ids = new Set<string>();
  for (const key of formData.keys()) {
    const m = /^(?:name|qty|price)_(.+)$/.exec(key);
    if (m && UUID.safeParse(m[1]).success) ids.add(m[1]!);
  }

  for (const id of ids) {
    const name = String(formData.get(`name_${id}`) ?? "").trim();
    const qty = Number(formData.get(`qty_${id}`));
    const price = Number(formData.get(`price_${id}`));
    const quantity = Number.isFinite(qty) && qty >= 0 ? qty : 0;
    const unitPrice = Number.isFinite(price) && price >= 0 ? price : 0;
    await supabase
      .from("ponudbe_quote_items")
      .update({
        product_name: name || "—",
        quantity,
        unit_price: unitPrice,
        net_amount: Math.round(quantity * unitPrice * 100) / 100,
      })
      .eq("id", id)
      .eq("quote_id", quoteId);
  }

  await recomputeTotals(supabase, quoteId);
  revalidatePath(BASE);
  redirect(`${BASE}?id=${quoteId}&ok=1`);
}

const DraftSchema = z.object({
  quote_id: UUID,
  draft_subject: z.string().max(300).optional(),
  draft_body: z.string().max(8000).optional(),
});

export async function saveDraft(formData: FormData) {
  const parsed = DraftSchema.safeParse({
    quote_id: formData.get("quote_id"),
    draft_subject: formData.get("draft_subject") ?? undefined,
    draft_body: formData.get("draft_body") ?? undefined,
  });
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const { supabase } = await requireAccess();
  const { error } = await supabase
    .from("ponudbe_quotes")
    .update({
      draft_subject: parsed.data.draft_subject ?? null,
      draft_body: parsed.data.draft_body ?? null,
    })
    .eq("id", parsed.data.quote_id);
  if (error) failDetail(parsed.data.quote_id, error.message);
  revalidatePath(BASE);
  redirect(`${BASE}?id=${parsed.data.quote_id}&ok=1`);
}

export async function markSent(formData: FormData) {
  const parsed = UUID.safeParse(formData.get("quote_id"));
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const { supabase } = await requireAccess();
  const { error } = await supabase
    .from("ponudbe_quotes")
    .update({ status: "sent", reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data);
  if (error) failDetail(parsed.data, error.message);
  revalidatePath(BASE);
  redirect(`${BASE}?id=${parsed.data}&ok=1`);
}

// ---------------------------------------------------------------- PDF
export async function generateQuotePdf(formData: FormData) {
  const parsed = UUID.safeParse(formData.get("quote_id"));
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const quoteId = parsed.data;
  const { supabase, user } = await requireAccess();

  const { data: quote } = await supabase
    .from("ponudbe_quotes")
    .select(
      "customer_name, customer_email, currency, net_amount, tax_amount, total_amount, created_at",
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) failDetail(quoteId, "Ponudba ni najdena.");

  const { data: items } = await supabase
    .from("ponudbe_quote_items")
    .select("line_no, product_name, quantity, unit, unit_price, net_amount, tax_rate")
    .eq("quote_id", quoteId)
    .order("line_no", { ascending: true });

  let buffer: Buffer;
  try {
    buffer = await buildQuotePdf({
      quote: {
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        currency: quote.currency ?? "EUR",
        net_amount: quote.net_amount,
        tax_amount: quote.tax_amount,
        total_amount: quote.total_amount,
        created_at: quote.created_at,
      },
      items: items ?? [],
    });
  } catch (e) {
    console.error("ponudbe pdf failed", e);
    failDetail(quoteId, "Ustvarjanje PDF ni uspelo.");
  }

  const path = `${user.id}/${crypto.randomUUID()}.pdf`;
  const upload = await supabase.storage
    .from(MODULE)
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (upload.error) failDetail(quoteId, `Shranjevanje PDF ni uspelo: ${upload.error.message}`);

  const { error } = await supabase
    .from("ponudbe_quotes")
    .update({ pdf_path: path })
    .eq("id", quoteId);
  if (error) failDetail(quoteId, error.message);

  revalidatePath(BASE);
  redirect(`${BASE}?id=${quoteId}&ok=1`);
}

// ---------------------------------------------------------------- ZOHO write-back
export async function pushQuoteToZoho(formData: FormData) {
  const parsed = UUID.safeParse(formData.get("quote_id"));
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const quoteId = parsed.data;
  const { supabase } = await requireAccess();

  const { data: quote } = await supabase
    .from("ponudbe_quotes")
    .select("id, draft_subject, customer_name, zoho_contact_id, zoho_quote_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) failDetail(quoteId, "Ponudba ni najdena.");
  // Idempotency guard — never POST twice (not just a disabled button).
  if (quote.zoho_quote_id) failDetail(quoteId, "Ponudba je že poslana v ZOHO.");

  const { data: items } = await supabase
    .from("ponudbe_quote_items")
    .select("zoho_product_id, product_name, quantity, unit_price")
    .eq("quote_id", quoteId);

  const pushable = (items ?? [])
    .filter((it) => it.zoho_product_id)
    .map((it) => ({
      zoho_product_id: it.zoho_product_id as string,
      product_name: it.product_name ?? "—",
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
    }));
  if (pushable.length === 0) {
    failDetail(quoteId, "Ni ujemajočih izdelkov (ZOHO ID) za prenos.");
  }

  let zohoId: string;
  try {
    const created = await createQuote({
      subject: quote.draft_subject || `Ponudba — ${quote.customer_name ?? ""}`.trim(),
      zoho_contact_id: quote.zoho_contact_id,
      items: pushable,
    });
    zohoId = created.id;
  } catch (e) {
    console.error("ponudbe zoho push failed", e);
    failDetail(quoteId, "Prenos v ZOHO ni uspel.");
  }

  const { error } = await supabase
    .from("ponudbe_quotes")
    .update({ zoho_quote_id: zohoId })
    .eq("id", quoteId)
    .is("zoho_quote_id", null); // race guard
  if (error) failDetail(quoteId, error.message);

  revalidatePath(BASE);
  redirect(`${BASE}?id=${quoteId}&ok=1`);
}
