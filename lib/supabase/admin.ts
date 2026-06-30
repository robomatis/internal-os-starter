// Service-role Supabase client — SERVER ONLY. DONE — do not modify.
//
// This client uses SUPABASE_SERVICE_ROLE_KEY, which BYPASSES Row Level Security
// and can do anything (create/delete users, edit any row). It is used ONLY
// inside owner-guarded admin server actions (modules/admin/actions.ts).
//
// NEVER import this into a client component. NEVER expose the key (no
// NEXT_PUBLIC_). The owner check in each action is the security boundary, since
// this client ignores RLS.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
