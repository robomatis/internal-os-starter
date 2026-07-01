"use server";

// potni_nalogi write path. Mirrors the invoice_ocr action: validate → call the
// external API server-side (modules/potni_nalogi/lib/maps.ts) → write the module's
// PREFIXED, RLS-scoped table → revalidate. Every action re-checks userCanAccess, so a
// member without the module can't drive it by posting directly.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { userCanAccess } from "@/lib/access";
import { distanceKm } from "./lib/maps";

const MODULE = "potni_nalogi";
const BASE = `/m/${MODULE}`;

function fail(message: string): never {
  redirect(`${BASE}?error=${encodeURIComponent(message)}`);
}

const NalogSchema = z.object({
  stranka: z.string().trim().min(1, "Vnesi stranko.").max(200, "Stranka je predolga."),
  kraj_od: z.string().trim().min(1, "Vnesi kraj odhoda.").max(200, "Kraj odhoda je predolg."),
  kraj_do: z.string().trim().min(1, "Vnesi cilj.").max(200, "Cilj je predolg."),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vnesi veljaven datum."),
  namen: z.string().trim().max(500, "Namen je predolg.").optional(),
});

export async function createNalog(formData: FormData) {
  const parsed = NalogSchema.safeParse({
    stranka: formData.get("stranka"),
    kraj_od: formData.get("kraj_od"),
    kraj_do: formData.get("kraj_do"),
    datum: formData.get("datum"),
    namen: (() => {
      const v = formData.get("namen");
      return v === null || String(v).trim() === "" ? undefined : String(v);
    })(),
  });
  if (!parsed.success) fail(parsed.error.issues[0]!.message);
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Same server-side access check the router enforces.
  if (!(await userCanAccess(supabase, user.id, MODULE))) fail("Nimaš dostopa do tega modula.");

  // Google Maps computes the distance (server-side, read-only). No key → mock km.
  let km = 0;
  let distanceMock = false;
  try {
    const r = await distanceKm(d.kraj_od, d.kraj_do);
    km = r.km;
    distanceMock = r.mock;
  } catch (e) {
    fail(e instanceof Error ? e.message : "Izračun razdalje ni uspel.");
  }

  const { data: inserted, error } = await supabase
    .from("potni_nalogi_zapisi")
    .insert({
      user_id: user.id,
      stranka: d.stranka,
      kraj_od: d.kraj_od,
      kraj_do: d.kraj_do,
      datum: d.datum,
      namen: d.namen ?? null,
      km,
      distance_mock: distanceMock,
    })
    .select("id")
    .single();
  if (error || !inserted) fail(error?.message ?? "Shranjevanje potnega naloga ni uspelo.");

  revalidatePath(BASE);
  redirect(`${BASE}?id=${inserted.id}&ok=1`);
}
