// Server-only website catalogue enrichment. ZOHO gives us SKU + short name + price;
// the website gives richer product copy for the quote. We fetch per SKU (built from
// Product_Code) and cache for the process lifetime. On ANY failure we fall back to the
// ZOHO Description — enrichment must never break the pipeline. With no WEBSITE_BASE_URL
// we serve bundled mock descriptions.
import "server-only";
import {
  MOCK_WEBSITE_DESCRIPTIONS,
  type ZohoProduct,
  type CatalogItem,
} from "./mock-data";

const BASE = process.env.WEBSITE_BASE_URL;

export function websiteConfigured(): boolean {
  return Boolean(BASE);
}

// SKU → resolved description (null = looked up, found nothing). Process-lifetime cache.
const cache = new Map<string, string | null>();

// Strip tags/script/style and collapse whitespace — no new dependency.
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDescription(sku: string): Promise<string | null> {
  if (cache.has(sku)) return cache.get(sku) ?? null;
  // Slug convention: {base}/izdelek/{sku}. Adjust here if the site differs.
  const url = `${BASE!.replace(/\/$/, "")}/izdelek/${encodeURIComponent(sku.toLowerCase())}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      cache.set(sku, null);
      return null;
    }
    const text = stripHtml(await res.text()).slice(0, 600);
    const value = text || null;
    cache.set(sku, value);
    return value;
  } catch {
    cache.set(sku, null);
    return null;
  }
}

/** Resolve the best description for one product (website → ZOHO fallback). */
async function describe(product: ZohoProduct): Promise<string | null> {
  if (!product.code) return product.description;
  if (!BASE) {
    return MOCK_WEBSITE_DESCRIPTIONS[product.code] ?? product.description;
  }
  return (await fetchDescription(product.code)) ?? product.description;
}

/** Build the quote catalogue: ZOHO products enriched with website copy. */
export async function buildCatalog(products: ZohoProduct[]): Promise<CatalogItem[]> {
  return Promise.all(
    products.map(async (p) => ({
      id: p.id,
      sku: p.code,
      name: p.name,
      unit_price: p.unit_price,
      description: await describe(p),
    })),
  );
}
