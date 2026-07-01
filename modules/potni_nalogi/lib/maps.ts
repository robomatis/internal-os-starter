// Server-side Google Maps distance client (READ-ONLY). The /integrate-api pattern,
// modeled on modules/crm_demo/lib/intrix.ts.
//
// Given a relation "od → do", returns the driving distance in km. If
// GOOGLE_MAPS_API_KEY is unset it serves a deterministic mock distance and flags
// `mock: true` — so the module always works (the workshop fallback), key or not.
//
// READ-ONLY: this only reads a distance. No write call goes back to Google.
import "server-only";

const KEY = process.env.GOOGLE_MAPS_API_KEY;
const ENDPOINT = "https://maps.googleapis.com/maps/api/distancematrix/json";

export type DistanceResult = { km: number; mock: boolean };

// Stable pseudo-distance from the two place names, so mock mode is repeatable
// (the same relation always yields the same km). Range ~5–450 km.
function mockKm(origin: string, destination: string): number {
  const s = `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Math.round(((5 + (h % 4450) / 10) * 10)) / 10; // one decimal
}

export async function distanceKm(
  origin: string,
  destination: string,
): Promise<DistanceResult> {
  if (!KEY) {
    return { km: mockKm(origin, destination), mock: true };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("units", "metric");
  url.searchParams.set("key", KEY);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Google Maps zahteva ni uspela: ${res.status}`);

  const data = (await res.json()) as {
    status?: string;
    rows?: { elements?: { status?: string; distance?: { value?: number } }[] }[];
  };
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK" || typeof el.distance?.value !== "number") {
    throw new Error(
      `Razdalje ni mogoče izračunati za "${origin}" → "${destination}". Preveri kraja.`,
    );
  }
  // meters → km, one decimal
  return { km: Math.round(el.distance.value / 100) / 10, mock: false };
}
