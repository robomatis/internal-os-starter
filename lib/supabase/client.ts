// Browser-side Supabase client (@supabase/ssr).
// DONE — do not modify. Uses the public anon key; RLS in the database is the
// real protection. Safe to ship to the browser.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
