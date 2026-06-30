"use server";

// invoice_ocr write paths. Mirrors the ai_assist action: validate → (store the file) →
// call the model server-side (modules/invoice_ocr/lib/ocr.ts) → write the module's
// PREFIXED, RLS-scoped table → revalidate. Every action re-checks userCanAccess, so a
// member without the module can't drive it by posting directly.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { userCanAccess } from "@/lib/access";
import { AiDailyLimitError, recordAiUsage } from "@/lib/ai-budget";
import {
  extractInvoice,
  emptyInvoiceFields,
  type InvoiceFields,
  type LineItem,
} from "./lib/ocr";

const MODULE = "invoice_ocr";
const BASE = `/m/${MODULE}`;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (next.config raises the Server Action body limit)
const ACCEPT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
};

function fail(message: string): never {
  redirect(`${BASE}?error=${encodeURIComponent(message)}`);
}

export async function uploadInvoice(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail("Najprej izberi datoteko računa.");
  if (!(file.type in ACCEPT)) fail("Dovoljeni formati: PNG, JPG ali PDF.");
  if (file.size > MAX_BYTES) fail("Datoteka je prevelika (največ 8 MB).");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Same server-side access check the router enforces.
  if (!(await userCanAccess(supabase, user.id, MODULE))) fail("Nimaš dostopa do tega modula.");

  const ext = ACCEPT[file.type];
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  // 1) Keep the original. Private bucket; storage RLS scopes it to this user's folder.
  const upload = await supabase.storage
    .from(MODULE)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upload.error) fail(`Nalaganje datoteke ni uspelo: ${upload.error.message}`);

  // 2) AI reads it (server-side). No key → a mock sample invoice, so this still works.
  let extracted: {
    data: InvoiceFields;
    lineItems: LineItem[];
    raw: string;
    mock: boolean;
  } = {
    data: emptyInvoiceFields(),
    lineItems: [],
    raw: "",
    mock: false,
  };
  try {
    await recordAiUsage(supabase, MODULE);
    extracted = await extractInvoice({
      base64: bytes.toString("base64"),
      mime: file.type,
      filename: file.name,
    });
  } catch (e) {
    if (e instanceof AiDailyLimitError) {
      fail("Dnevna AI omejitev je dosežena. Poskusi jutri.");
    }
    // The file is saved; create a row with empty fields the user can fix by hand.
    console.error("invoice_ocr extract failed", e);
  }

  // 3) The invoice header row in the module's prefixed, RLS-scoped table.
  const d = extracted.data;
  const { data: inserted, error } = await supabase
    .from("invoice_ocr_invoices")
    .insert({
      user_id: user.id,
      file_path: path,
      file_mime: file.type,
      vendor: d.vendor,
      invoice_number: d.invoice_number,
      issue_date: d.issue_date,
      due_date: d.due_date,
      currency: d.currency,
      net_amount: d.net_amount,
      tax_amount: d.tax_amount,
      total_amount: d.total_amount,
      raw_json: { model_output: extracted.raw },
      extracted_mock: extracted.mock,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !inserted) fail(error?.message ?? "Shranjevanje računa ni uspelo.");

  // 4) The line items — normalized child rows (one per postavka). The header is already
  // saved, so a line-insert hiccup must not fail the whole upload: log it and move on.
  if (extracted.lineItems.length) {
    const rows = extracted.lineItems.map((li, i) => ({
      invoice_id: inserted.id,
      user_id: user.id,
      line_no: i + 1,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_price: li.unit_price,
      net_amount: li.net_amount,
      tax_rate: li.tax_rate,
      tax_amount: li.tax_amount,
      total_amount: li.total_amount,
    }));
    const { error: lineErr } = await supabase
      .from("invoice_ocr_line_items")
      .insert(rows);
    if (lineErr) console.error("invoice_ocr line items insert failed", lineErr);
  }

  revalidatePath(BASE);
  redirect(`${BASE}?ok=1`);
}

// Liquidation happens on the detail / review screen. Two actions (approve / reject)
// share one form via formAction; both carry the invoice id + the optional comment.
const LiquidateSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F-]{36}$/, "Neveljaven ID"),
  comment: z.string().max(2000, "Komentar je predolg (največ 2000 znakov).").optional(),
});

async function liquidate(status: "approved" | "rejected", formData: FormData) {
  const rawComment = formData.get("comment");
  const parsed = LiquidateSchema.safeParse({
    id: formData.get("id"),
    comment: rawComment === null ? undefined : String(rawComment),
  });
  if (!parsed.success) fail(parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await userCanAccess(supabase, user.id, MODULE))) fail("Nimaš dostopa do tega modula.");

  // RLS guarantees a user can only update their OWN invoice rows.
  const { error } = await supabase
    .from("invoice_ocr_invoices")
    .update({
      status,
      comment: parsed.data.comment ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) fail(error.message);

  revalidatePath(BASE);
  // Back to the review screen so the new status + comment show in place.
  redirect(`${BASE}?id=${parsed.data.id}&ok=1`);
}

export async function approveInvoice(formData: FormData) {
  await liquidate("approved", formData);
}

export async function rejectInvoice(formData: FormData) {
  await liquidate("rejected", formData);
}
