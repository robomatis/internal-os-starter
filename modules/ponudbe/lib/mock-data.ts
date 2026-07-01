// Bundled fixtures + shared domain types for the ponudbe module. Every external
// client (Graph, ZOHO, website) falls back to these when its env vars are unset, so
// the whole pipeline demos end-to-end with zero credentials and zero spend — the same
// idea as crm_demo's Intrix mock. Neutral placeholder branding for now.

// ---- Email (shape we keep, normalized from Microsoft Graph) --------------------
export type PonudbeEmail = {
  message_id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  received_at: string | null; // ISO 8601
  body_text: string | null;
};

// ---- ZOHO CRM ------------------------------------------------------------------
export type ZohoProduct = {
  id: string; // ZOHO record id
  name: string; // Product_Name
  code: string | null; // Product_Code (our SKU)
  unit_price: number | null; // Unit_Price
  description: string | null; // Description
};

export type ZohoContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_name: string | null;
};

// ---- Catalogue (ZOHO product enriched with website copy) -----------------------
export type CatalogItem = {
  id: string; // ZOHO product id
  sku: string | null;
  name: string;
  unit_price: number | null;
  description: string | null; // website copy preferred, ZOHO Description as fallback
};

// ---- A matched quote line (the model's output, resolved against the catalogue) --
export type MatchedLine = {
  requested_text: string;
  sku: string | null;
  zoho_product_id: string | null;
  product_name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  confidence: number; // 0..1
};

// Two realistic Slovenian quote requests + one obvious spam, so sync + classification
// + matching all demo without a mailbox.
export const MOCK_EMAILS: PonudbeEmail[] = [
  {
    message_id: "mock-msg-0001",
    from_email: "nabava@pakirni-center.si",
    from_name: "Pakirni Center d.o.o.",
    subject: "Povpraševanje — PET trak in napenjalec",
    received_at: "2026-06-29T08:14:00Z",
    body_text:
      "Pozdravljeni,\n\nProsimo za ponudbo za naslednje:\n- PET trak 16 mm, 2 paleti\n- ročni napenjalec za PET trak, 2 kos\n- plastične sponke 16 mm, 5000 kos\n\nDostava v Ljubljano. Prosim za ceno in dobavni rok.\n\nLep pozdrav,\nMarko Zupan",
  },
  {
    message_id: "mock-msg-0002",
    from_email: "info@lesko.si",
    from_name: "Lesko",
    subject: "Jeklena vezalna oprema",
    received_at: "2026-06-28T13:42:00Z",
    body_text:
      "Spoštovani,\n\nzanima nas jekleni trak 19 mm in pripadajoče kovinske sponke. Količina ca. 1 paleta traku in 2000 sponk. Hvala za ponudbo.\n\nEva Kralj",
  },
  {
    message_id: "mock-msg-0003",
    from_email: "promo@cheap-deals-online.example",
    from_name: "Mega Deals",
    subject: "🔥 You WON a $1000 gift card!!! Claim now",
    received_at: "2026-06-27T22:05:00Z",
    body_text:
      "Congratulations!!! Click here to claim your FREE prize before it expires. Limited time offer, act now!!!",
  },
];

// A small battery-strapping / packaging catalogue (neutral placeholder data).
export const MOCK_PRODUCTS: ZohoProduct[] = [
  {
    id: "zp-pet16",
    name: "PET trak 16 mm",
    code: "PET-16",
    unit_price: 89.0,
    description: "PET vezalni trak 16 mm, paleta.",
  },
  {
    id: "zp-pet19",
    name: "PET trak 19 mm",
    code: "PET-19",
    unit_price: 105.0,
    description: "PET vezalni trak 19 mm, paleta.",
  },
  {
    id: "zp-steel19",
    name: "Jekleni trak 19 mm",
    code: "STEEL-19",
    unit_price: 140.0,
    description: "Jekleni vezalni trak 19 mm, paleta.",
  },
  {
    id: "zp-tensioner",
    name: "Ročni napenjalec za PET trak",
    code: "TOOL-TENS",
    unit_price: 220.0,
    description: "Ročni napenjalec za plastične trakove.",
  },
  {
    id: "zp-seal16",
    name: "Plastične sponke 16 mm",
    code: "SEAL-PET16",
    unit_price: 0.04,
    description: "Plastične sponke za PET trak 16 mm.",
  },
  {
    id: "zp-seal19",
    name: "Kovinske sponke 19 mm",
    code: "SEAL-STEEL19",
    unit_price: 0.06,
    description: "Kovinske sponke za jekleni trak 19 mm.",
  },
];

export const MOCK_CONTACTS: ZohoContact[] = [
  {
    id: "zc-001",
    first_name: "Marko",
    last_name: "Zupan",
    email: "nabava@pakirni-center.si",
    account_name: "Pakirni Center d.o.o.",
  },
  {
    id: "zc-002",
    first_name: "Eva",
    last_name: "Kralj",
    email: "info@lesko.si",
    account_name: "Lesko",
  },
];

// Richer "website" descriptions keyed by SKU — what website-catalog.ts returns in
// mock mode (no WEBSITE_BASE_URL).
export const MOCK_WEBSITE_DESCRIPTIONS: Record<string, string> = {
  "PET-16":
    "PET vezalni trak 16 mm za srednje težke tovore. Visoka natezna trdnost, nizek raztezek, primeren za ročno in strojno vezanje. Dobava na paleti.",
  "PET-19":
    "PET vezalni trak 19 mm za težje tovore in palete. Odporen na vlago in UV, nadomešča jekleni trak pri večini aplikacij.",
  "STEEL-19":
    "Jekleni vezalni trak 19 mm za najtežje obremenitve in ostre robove. Pocinkan za zaščito pred korozijo.",
  "TOOL-TENS":
    "Ročni napenjalec za plastične (PET/PP) trakove. Ergonomski ročaj, nastavljiva napetost, primeren za 13–19 mm trakove.",
  "SEAL-PET16": "Plastične sponke za pritrditev PET traku 16 mm. Pakiranje 1000 kos.",
  "SEAL-STEEL19": "Kovinske sponke za jekleni trak 19 mm. Visoka strižna trdnost.",
};
