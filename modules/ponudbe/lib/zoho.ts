// Server-only ZOHO CRM client. Modeled on crm_demo/lib/intrix.ts: read Products +
// Contacts, and (owner-approved) WRITE the finished quote back as a Quotes record.
// With NO credentials it falls back to bundled mock data and never POSTs.
//
// Setup (one-time, out of band): create a self-client in the ZOHO API console
// (api-console.zoho.eu), generate a refresh token with scopes
// ZohoCRM.modules.products.READ, ZohoCRM.modules.contacts.READ,
// ZohoCRM.modules.quotes.CREATE. Then set ZOHO_*. The access token is exchanged on
// demand and cached in memory (~1h) — never stored in the DB.
//
// REGION: accounts + API domains MUST match the same region (default EU) or ZOHO
// rejects the token. Override ZOHO_ACCOUNTS_DOMAIN / ZOHO_API_DOMAIN for other regions.
import "server-only";
import {
  MOCK_PRODUCTS,
  MOCK_CONTACTS,
  type ZohoProduct,
  type ZohoContact,
} from "./mock-data";

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ACCOUNTS = process.env.ZOHO_ACCOUNTS_DOMAIN ?? "https://accounts.zoho.eu";
const API = process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.eu";

/** True when the self-client credentials are present. */
export function zohoConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    refresh_token: REFRESH_TOKEN!,
  });
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ZOHO token failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!json.access_token) {
    throw new Error(`ZOHO token error: ${json.error ?? "no access_token"}`);
  }
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

function authHeaders(token: string) {
  return { Authorization: `Zoho-oauthtoken ${token}` };
}

type ZohoProductRecord = {
  id: string;
  Product_Name?: string;
  Product_Code?: string;
  Unit_Price?: number;
  Description?: string;
};

export async function listProducts(): Promise<{
  products: ZohoProduct[];
  mock: boolean;
}> {
  if (!zohoConfigured()) return { products: MOCK_PRODUCTS, mock: true };
  const token = await getAccessToken();
  const res = await fetch(
    `${API}/crm/v6/Products?fields=Product_Name,Product_Code,Unit_Price,Description&per_page=200`,
    { headers: authHeaders(token), cache: "no-store" },
  );
  // 204 = no records.
  if (res.status === 204) return { products: [], mock: false };
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ZOHO products failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: ZohoProductRecord[] };
  const products = (json.data ?? []).map((p) => ({
    id: p.id,
    name: p.Product_Name ?? "—",
    code: p.Product_Code ?? null,
    unit_price: typeof p.Unit_Price === "number" ? p.Unit_Price : null,
    description: p.Description ?? null,
  }));
  return { products, mock: false };
}

type ZohoContactRecord = {
  id: string;
  First_Name?: string;
  Last_Name?: string;
  Email?: string;
  Account_Name?: { name?: string } | string;
};

function accountName(a: ZohoContactRecord["Account_Name"]): string | null {
  if (!a) return null;
  return typeof a === "string" ? a : (a.name ?? null);
}

export async function listContacts(): Promise<{
  contacts: ZohoContact[];
  mock: boolean;
}> {
  if (!zohoConfigured()) return { contacts: MOCK_CONTACTS, mock: true };
  const token = await getAccessToken();
  const res = await fetch(
    `${API}/crm/v6/Contacts?fields=First_Name,Last_Name,Email,Account_Name&per_page=200`,
    { headers: authHeaders(token), cache: "no-store" },
  );
  if (res.status === 204) return { contacts: [], mock: false };
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ZOHO contacts failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: ZohoContactRecord[] };
  const contacts = (json.data ?? []).map((c) => ({
    id: c.id,
    first_name: c.First_Name ?? null,
    last_name: c.Last_Name ?? null,
    email: c.Email ?? null,
    account_name: accountName(c.Account_Name),
  }));
  return { contacts, mock: false };
}

/** Best-effort contact lookup by email (case-insensitive). Returns null if unknown. */
export async function findContactByEmail(email: string | null): Promise<{
  contact: ZohoContact | null;
  mock: boolean;
}> {
  if (!email) {
    return { contact: null, mock: !zohoConfigured() };
  }
  const { contacts, mock } = await listContacts();
  const needle = email.trim().toLowerCase();
  const contact =
    contacts.find((c) => (c.email ?? "").toLowerCase() === needle) ?? null;
  return { contact, mock };
}

export type ZohoQuotePayload = {
  subject: string;
  zoho_contact_id: string | null;
  items: {
    zoho_product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

/**
 * Create a Quotes record in ZOHO. Only items with a real zoho_product_id are sent
 * (ZOHO line items require a product reference). In mock mode no POST happens and a
 * synthetic id is returned. The CALLER owns idempotency (only call when the local
 * quote has no zoho_quote_id yet).
 */
export async function createQuote(payload: ZohoQuotePayload): Promise<{
  id: string;
  mock: boolean;
}> {
  if (!zohoConfigured()) {
    return { id: `mock-quote-${crypto.randomUUID()}`, mock: true };
  }
  const token = await getAccessToken();
  const record: Record<string, unknown> = {
    Subject: payload.subject,
    Quoted_Items: payload.items.map((it) => ({
      Product_Name: { id: it.zoho_product_id },
      Quantity: it.quantity,
      List_Price: it.unit_price,
    })),
  };
  if (payload.zoho_contact_id) {
    record.Contact_Name = { id: payload.zoho_contact_id };
  }
  const res = await fetch(`${API}/crm/v6/Quotes`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ data: [record] }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ZOHO create quote failed: ${res.status} ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    data?: { code?: string; details?: { id?: string }; message?: string }[];
  };
  const row = json.data?.[0];
  if (!row || row.code !== "SUCCESS" || !row.details?.id) {
    throw new Error(`ZOHO create quote rejected: ${row?.message ?? "unknown error"}`);
  }
  return { id: row.details.id, mock: false };
}
