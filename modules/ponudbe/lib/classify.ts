// Server-only email classifier. Modeled on invoice_ocr/lib/ocr.ts: this module owns
// its own OpenRouter client (lib/ai.ts is text-only + "never modify" and capped at 500
// tokens). Reuses the SAME capped OPENROUTER_API_KEY; with NO key it falls back to a
// deterministic keyword heuristic so sync + the inbox demo without spend.
import "server-only";

const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-haiku";

export type Classification = "quote_request" | "spam" | "other";

export type ClassifyResult = {
  classification: Classification;
  reason: string;
  mock: boolean;
};

const SYSTEM = [
  "Si pomočnik za razvrščanje vhodne poslovne e-pošte.",
  "Določi, ali je sporočilo POVPRAŠEVANJE ZA PONUDBO (stranka želi ceno/ponudbo za izdelke ali storitve), NEŽELENA POŠTA (spam/oglas/prevara) ali DRUGO.",
  'Vrni IZKLJUČNO JSON v obliki: {"classification":"quote_request|spam|other","reason":string}.',
  "reason naj bo kratek (največ 12 besed), v slovenščini. Brez razlage izven JSON, brez markdown ograj.",
].join(" ");

export async function classifyEmail(params: {
  subject: string | null;
  body: string | null;
}): Promise<ClassifyResult> {
  if (!KEY) return mockClassify(params);

  const prompt = `Zadeva: ${params.subject ?? "(brez)"}\n\nVsebina:\n${(params.body ?? "").slice(0, 4000)}`;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter classify failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  return { ...parseClassification(raw), mock: false };
}

function parseClassification(raw: string): {
  classification: Classification;
  reason: string;
} {
  try {
    const match = raw.replace(/```json|```/gi, "").match(/\{[\s\S]*\}/);
    if (!match) return { classification: "other", reason: "Neprepoznan odgovor." };
    const o = JSON.parse(match[0]) as { classification?: string; reason?: string };
    const c = o.classification;
    const classification: Classification =
      c === "quote_request" || c === "spam" || c === "other" ? c : "other";
    return {
      classification,
      reason: typeof o.reason === "string" ? o.reason.slice(0, 200) : "",
    };
  } catch {
    return { classification: "other", reason: "Napaka pri razčlenjevanju." };
  }
}

// Deterministic keyless fallback — keyword heuristic, Slovenian + English cues.
const QUOTE_CUES = [
  "povpraševanje",
  "ponudb",
  "ponudbo",
  "cena",
  "ceno",
  "cenik",
  "naroč",
  "dobavni rok",
  "quote",
  "quotation",
  "pricing",
  "price",
  "rfq",
];
const SPAM_CUES = [
  "you won",
  "free prize",
  "gift card",
  "claim now",
  "viagra",
  "casino",
  "kazino",
  "loan",
  "kredit takoj",
  "click here",
  "unsubscribe",
  "act now",
  "limited time offer",
];

function mockClassify(params: {
  subject: string | null;
  body: string | null;
}): ClassifyResult {
  const hay = `${params.subject ?? ""}\n${params.body ?? ""}`.toLowerCase();
  if (SPAM_CUES.some((w) => hay.includes(w))) {
    return {
      classification: "spam",
      reason: "Vsebuje značilne oglasne/prevarantske fraze.",
      mock: true,
    };
  }
  if (QUOTE_CUES.some((w) => hay.includes(w))) {
    return {
      classification: "quote_request",
      reason: "Omenja ponudbo/ceno/povpraševanje.",
      mock: true,
    };
  }
  return {
    classification: "other",
    reason: "Ni jasnih znakov povpraševanja.",
    mock: true,
  };
}
