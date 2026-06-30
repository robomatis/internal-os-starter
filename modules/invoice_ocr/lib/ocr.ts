// Server-only invoice OCR via OpenRouter (a VISION model). Modeled on
// modules/crm_demo/lib/intrix.ts: reuse the SAME capped OPENROUTER_API_KEY, and with
// NO key fall back to a sample invoice (mock) so the module works end-to-end, zero spend.
//
// Why here and not lib/ai.ts? lib/ai.ts is the text-only worked example and is
// "never modify". Vision is a new capability, so — exactly like crm_demo owns its own
// Intrix client — this module owns its own AI client. Same key, same mock idea.
//
// Verified against the live OpenRouter API (2026-06-25): images use an image_url part,
// PDFs a file part (Claude ingests PDFs natively; the file-parser plugin keeps it working
// if you swap to a non-Claude model). Model slugs MOVE — verify the current one at
// openrouter.ai/models (e.g. the old claude-3.5-sonnet is gone; claude-sonnet-4.6 is
// current). Mock mode covers the keyless case.
import "server-only";

const KEY = process.env.OPENROUTER_API_KEY;
// Must be a VISION + PDF capable model. Slugs move — verify at openrouter.ai/models
// (claude-haiku-4.5 is cheaper; claude-opus-* is stronger).
const VISION_MODEL =
  process.env.OPENROUTER_VISION_MODEL ?? "anthropic/claude-sonnet-4.6";

export type InvoiceFields = {
  vendor: string | null;
  invoice_number: string | null;
  issue_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  currency: string | null;
  net_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
};

// One invoice line / postavka. Stored normalized in invoice_ocr_line_items so a future
// task can attach a comment or a dispute (status) to an individual line.
export type LineItem = {
  description: string | null;
  quantity: number | null;
  unit: string | null; // enota mere — kos, h, kg, …
  unit_price: number | null;
  net_amount: number | null;
  tax_rate: number | null; // DDV %
  tax_amount: number | null;
  total_amount: number | null;
};

export function emptyInvoiceFields(): InvoiceFields {
  return {
    vendor: null,
    invoice_number: null,
    issue_date: null,
    due_date: null,
    currency: null,
    net_amount: null,
    tax_amount: null,
    total_amount: null,
  };
}

// The keyless fallback — a realistic Slovenian invoice so the whole flow (table,
// detail, line items, status, CSV) demos without a key or any spend.
const SAMPLE: InvoiceFields = {
  vendor: "Mizarstvo Novak d.o.o.",
  invoice_number: "2026-0142",
  issue_date: "2026-06-18",
  due_date: "2026-07-18",
  currency: "EUR",
  net_amount: 1250.0,
  tax_amount: 275.0,
  total_amount: 1525.0,
};

// Lines that sum to SAMPLE (net 1250 / DDV 275 / skupaj 1525).
const SAMPLE_LINES: LineItem[] = [
  {
    description: "Hrastova jedilna miza 200×100",
    quantity: 1,
    unit: "kos",
    unit_price: 950.0,
    net_amount: 950.0,
    tax_rate: 22,
    tax_amount: 209.0,
    total_amount: 1159.0,
  },
  {
    description: "Dostava in montaža",
    quantity: 1,
    unit: "kos",
    unit_price: 300.0,
    net_amount: 300.0,
    tax_rate: 22,
    tax_amount: 66.0,
    total_amount: 366.0,
  },
];

const SYSTEM = [
  "Si pomočnik za zajem podatkov z računov (OCR).",
  "Iz priloženega računa (slika ali PDF) izlušči glavo IN vse postavke ter vrni IZKLJUČNO JSON v točno tej obliki:",
  '{"vendor":string|null,"invoice_number":string|null,"issue_date":string|null,"due_date":string|null,"currency":string|null,"net_amount":number|null,"tax_amount":number|null,"total_amount":number|null,"line_items":[{"description":string|null,"quantity":number|null,"unit":string|null,"unit_price":number|null,"net_amount":number|null,"tax_rate":number|null,"tax_amount":number|null,"total_amount":number|null}]}',
  "V line_items vključi VSAKO postavko/vrstico računa; če postavk ni, vrni prazen seznam [].",
  "Datume vrni v obliki YYYY-MM-DD. Zneske vrni kot števila brez valute in brez ločil tisočic (npr. 1525.00); tax_rate je odstotek (npr. 22).",
  "Če podatka ni, uporabi null. Brez razlage in brez markdown ograj — samo goli JSON.",
].join(" ");

export async function extractInvoice(params: {
  base64: string; // raw base64, no data: prefix
  mime: string; // image/png | image/jpeg | application/pdf
  filename?: string;
}): Promise<{
  data: InvoiceFields;
  lineItems: LineItem[];
  raw: string;
  mock: boolean;
}> {
  if (!KEY) {
    return {
      data: SAMPLE,
      lineItems: SAMPLE_LINES,
      raw: JSON.stringify({ ...SAMPLE, line_items: SAMPLE_LINES }),
      mock: true,
    };
  }

  const isPdf = params.mime === "application/pdf";
  const dataUrl = `data:${params.mime};base64,${params.base64}`;
  // OpenRouter is OpenAI-compatible: images → an image_url part; PDFs → a file part.
  const filePart = isPdf
    ? {
        type: "file",
        file: { filename: params.filename ?? "racun.pdf", file_data: dataUrl },
      }
    : { type: "image_url", image_url: { url: dataUrl } };

  const body: Record<string, unknown> = {
    model: VISION_MODEL,
    max_tokens: 4096, // room for the header + every line item (truncation → [] lines, handled)
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [{ type: "text", text: "Izlušči glavo in vse postavke s tega računa." }, filePart],
      },
    ],
  };
  // PDFs need OpenRouter's file-parser so the model actually reads the document.
  if (isPdf) body.plugins = [{ id: "file-parser", pdf: { engine: "native" } }];

  // Same shape as crm_demo's Intrix client — a plain server-side fetch with the key.
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    // Surface WHY (e.g. a bad/retired model slug returns 400 "model not found").
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter OCR failed: ${res.status} ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  const parsed = parseExtraction(raw);
  return { data: parsed.data, lineItems: parsed.lineItems, raw, mock: false };
}

// Tolerant parse: strip ``` fences, grab the first {...}, coerce types. On any failure
// return an empty header + no lines — the invoice row is still created so the user can fix it.
function parseExtraction(raw: string): { data: InvoiceFields; lineItems: LineItem[] } {
  try {
    const match = raw.replace(/```json|```/gi, "").match(/\{[\s\S]*\}/);
    if (!match) return { data: emptyInvoiceFields(), lineItems: [] };
    const o = JSON.parse(match[0]) as Record<string, unknown>;
    const lineItems = Array.isArray(o.line_items)
      ? (o.line_items as unknown[]).map(lineFrom)
      : [];
    return {
      data: {
        vendor: str(o.vendor),
        invoice_number: str(o.invoice_number),
        issue_date: dateStr(o.issue_date),
        due_date: dateStr(o.due_date),
        currency: str(o.currency),
        net_amount: num(o.net_amount),
        tax_amount: num(o.tax_amount),
        total_amount: num(o.total_amount),
      },
      lineItems,
    };
  } catch {
    return { data: emptyInvoiceFields(), lineItems: [] };
  }
}

function lineFrom(v: unknown): LineItem {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    description: str(o.description),
    quantity: num(o.quantity),
    unit: str(o.unit),
    unit_price: num(o.unit_price),
    net_amount: num(o.net_amount),
    tax_rate: num(o.tax_rate),
    tax_amount: num(o.tax_amount),
    total_amount: num(o.total_amount),
  };
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}
function dateStr(v: unknown): string | null {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; // only a clean date hits the date column
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
