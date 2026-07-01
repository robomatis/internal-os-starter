// Server-only quote assembly: match the email's requested items to catalogue SKUs and
// compose a draft reply. Module-owned OpenRouter client (own max_tokens), reusing the
// capped OPENROUTER_API_KEY. With NO key it falls back to a deterministic keyword match
// + a templated Slovenian draft, so the whole flow demos without spend.
import "server-only";
import type { CatalogItem, MatchedLine } from "./mock-data";

const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-haiku";

export type ComposeResult = {
  lines: MatchedLine[];
  draft_subject: string;
  draft_body: string;
  mock: boolean;
};

type EmailInput = {
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  body: string | null;
};

const SYSTEM = [
  "Si prodajni pomočnik. Iz povpraševanja stranke poveži želene izdelke z artikli iz priloženega kataloga in pripravi osnutek vljudnega odgovora v slovenščini.",
  'Vrni IZKLJUČNO JSON: {"lines":[{"requested_text":string,"sku":string|null,"quantity":number,"confidence":number}],"draft_subject":string,"draft_body":string}.',
  "sku MORA biti ena od vrednosti iz kataloga ali null, če ujemanja ni. quantity je število (privzeto 1). confidence je 0..1.",
  "V draft_body ne izmišljaj cen; sklicuj se na artikle in povabi k potrditvi. Brez markdown ograj, samo goli JSON.",
].join(" ");

export async function matchAndCompose(params: {
  email: EmailInput;
  catalog: CatalogItem[];
}): Promise<ComposeResult> {
  if (!KEY) return mockCompose(params);

  const compactCatalog = params.catalog.map((c) => ({
    sku: c.sku,
    name: c.name,
    unit_price: c.unit_price,
    description: (c.description ?? "").slice(0, 200),
  }));
  const prompt = [
    `Povpraševanje (zadeva): ${params.email.subject ?? "(brez)"}`,
    `Vsebina:\n${(params.email.body ?? "").slice(0, 4000)}`,
    `\nKatalog (JSON):\n${JSON.stringify(compactCatalog)}`,
  ].join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter compose failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  return { ...parseCompose(raw, params), mock: false };
}

// Resolve the model's {sku, quantity, ...} against the catalogue to fill in product
// name / price / id. Unknown or null sku → an unmatched line the human resolves.
function resolveLine(item: unknown, catalog: CatalogItem[]): MatchedLine {
  const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
  const sku =
    typeof o.sku === "string" && o.sku.trim() ? o.sku.trim() : null;
  const match = sku
    ? catalog.find((c) => (c.sku ?? "").toLowerCase() === sku.toLowerCase()) ?? null
    : null;
  const qtyN = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
  const quantity = Number.isFinite(qtyN) && qtyN > 0 ? qtyN : 1;
  const confN = typeof o.confidence === "number" ? o.confidence : Number(o.confidence);
  const confidence = Number.isFinite(confN)
    ? Math.max(0, Math.min(1, confN))
    : match
      ? 0.6
      : 0;
  const requested =
    typeof o.requested_text === "string" && o.requested_text.trim()
      ? o.requested_text
      : (match?.name ?? "—");
  return {
    requested_text: requested,
    sku: match?.sku ?? sku,
    zoho_product_id: match?.id ?? null,
    product_name: match?.name ?? requested,
    description: match?.description ?? null,
    quantity,
    unit: "kos",
    unit_price: match?.unit_price ?? null,
    confidence,
  };
}

function parseCompose(
  raw: string,
  params: { email: EmailInput; catalog: CatalogItem[] },
): Omit<ComposeResult, "mock"> {
  try {
    const match = raw.replace(/```json|```/gi, "").match(/\{[\s\S]*\}/);
    if (!match) return mockComposeBody(params);
    const o = JSON.parse(match[0]) as {
      lines?: unknown[];
      draft_subject?: string;
      draft_body?: string;
    };
    const lines = Array.isArray(o.lines)
      ? o.lines.map((l) => resolveLine(l, params.catalog))
      : [];
    return {
      lines,
      draft_subject:
        typeof o.draft_subject === "string" && o.draft_subject.trim()
          ? o.draft_subject
          : defaultSubject(params.email),
      draft_body:
        typeof o.draft_body === "string" && o.draft_body.trim()
          ? o.draft_body
          : defaultBody(params.email, lines),
    };
  } catch {
    return mockComposeBody(params);
  }
}

// ---- Deterministic keyless fallback -------------------------------------------

// Match by keyword overlap. Rule: every digit-token in the product name (e.g. the
// size "16") must appear in the email, and ≥50% of the word-tokens (len ≥ 3) must too —
// so "PET trak 16 mm" matches but "PET trak 19 mm" does not when 19 is absent.
function mockMatch(body: string, catalog: CatalogItem[]): MatchedLine[] {
  const hay = body.toLowerCase();
  const lines: MatchedLine[] = [];
  for (const c of catalog) {
    const tokens = c.name.toLowerCase().split(/[^0-9a-zčšž]+/i).filter(Boolean);
    const digits = tokens.filter((t) => /\d/.test(t));
    const words = tokens.filter((t) => !/\d/.test(t) && t.length >= 3);
    if (digits.length && !digits.every((d) => hay.includes(d))) continue;
    const hits = words.filter((w) => hay.includes(w)).length;
    if (words.length === 0 || hits / words.length < 0.5) continue;
    lines.push({
      requested_text: c.name,
      sku: c.sku,
      zoho_product_id: c.id,
      product_name: c.name,
      description: c.description,
      quantity: 1,
      unit: "kos",
      unit_price: c.unit_price,
      confidence: 0.55,
    });
  }
  return lines;
}

function defaultSubject(email: EmailInput): string {
  const ref = email.subject ? `: ${email.subject}` : "";
  return `Ponudba${ref}`;
}

function defaultBody(email: EmailInput, lines: MatchedLine[]): string {
  const greeting = email.from_name ? `Spoštovani ${email.from_name},` : "Spoštovani,";
  const items = lines.length
    ? lines.map((l) => `- ${l.product_name} (${l.quantity} ${l.unit ?? "kos"})`).join("\n")
    : "- (postavke dodajte ročno)";
  return [
    greeting,
    "",
    "hvala za vaše povpraševanje. V priponki pošiljamo ponudbo za:",
    items,
    "",
    "Za potrditev ali dodatna vprašanja smo vam na voljo.",
    "",
    "Lep pozdrav,",
    "[Vaše podjetje]",
  ].join("\n");
}

function mockComposeBody(params: {
  email: EmailInput;
  catalog: CatalogItem[];
}): Omit<ComposeResult, "mock"> {
  const lines = mockMatch(params.email.body ?? "", params.catalog);
  return {
    lines,
    draft_subject: defaultSubject(params.email),
    draft_body: defaultBody(params.email, lines),
  };
}

function mockCompose(params: {
  email: EmailInput;
  catalog: CatalogItem[];
}): ComposeResult {
  return { ...mockComposeBody(params), mock: true };
}
