// Server-side Supabase client (@supabase/ssr) for Server Components, Route
// Handlers, and Server Actions. DONE — do not modify.
// Note: in Next.js 15 `cookies()` is async, so this helper is async too.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where setting cookies is not
            // allowed. Safe to ignore — the middleware refreshes the session.
          }
        },
      },
    },
  );
}
