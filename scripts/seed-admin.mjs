import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const fullName = process.env.ADMIN_FULL_NAME?.trim() || null;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (!url || !key || !email) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ADMIN_EMAIL.");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const redirectTo = `${siteUrl}/auth/callback?next=/setup-password`;

async function createAdminLink() {
  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName }, redirectTo },
  });

  if (!invite.error) {
    return { kind: "invite", ...invite.data };
  }

  const recovery = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (recovery.error) {
    throw new Error(`Could not create invite/recovery link: ${invite.error.message}; ${recovery.error.message}`);
  }

  return { kind: "recovery", ...recovery.data };
}

const link = await createAdminLink();
const user = link.user;
if (!user?.id) {
  throw new Error("Supabase did not return a user for the admin link.");
}

const { error: profileError } = await admin.from("core_profiles").upsert({
  id: user.id,
  full_name: fullName,
  email,
  role: "owner",
  disabled: false,
});
if (profileError) throw profileError;

const { data: modules, error: moduleError } = await admin
  .from("core_modules")
  .select("id");
if (moduleError) throw moduleError;

const grants = (modules ?? []).map((m) => ({
  user_id: user.id,
  module_id: m.id,
  granted_by: user.id,
}));

if (grants.length > 0) {
  const { error: grantError } = await admin
    .from("core_user_modules")
    .upsert(grants, { onConflict: "user_id,module_id" });
  if (grantError) throw grantError;
}

console.log(`Admin ${email} is owner and has ${grants.length} module grant(s).`);
console.log(`${link.kind === "invite" ? "Invite" : "Password setup"} link:`);
console.log(link.properties?.action_link);
