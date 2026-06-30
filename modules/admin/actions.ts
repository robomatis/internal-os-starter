"use server";

// Admin actions. Every action is OWNER-ONLY (checked first). User-lifecycle and
// module-config writes use the service-role admin client (bypasses RLS) — so the
// owner check here IS the security boundary. Module grants (setAccess) stay on
// the authenticated client + RLS. DONE — do not modify.
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/access";

// Returns the calling user iff they are an owner; otherwise null.
async function callerIfOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isOwner(supabase, user.id))) return null;
  return user;
}

async function ownerCount(admin: SupabaseClient): Promise<number> {
  const { count } = await admin
    .from("core_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  return count ?? 0;
}

async function roleOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("core_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as string | null) ?? null;
}

const done = () => revalidatePath("/m/admin");
const doneWithLauncher = () => {
  revalidatePath("/m/admin");
  revalidatePath("/home");
};

// ===== Module access grid (authenticated client + RLS; unchanged behaviour) =====
export async function setAccess(formData: FormData) {
  const caller = await callerIfOwner();
  if (!caller) return;
  const userId = String(formData.get("user_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  const grant = String(formData.get("grant") ?? "") === "1";

  const supabase = await createClient();
  if (grant) {
    await supabase
      .from("core_user_modules")
      .insert({ user_id: userId, module_id: moduleId, granted_by: caller.id });
  } else {
    await supabase
      .from("core_user_modules")
      .delete()
      .eq("user_id", userId)
      .eq("module_id", moduleId);
  }
  done();
}

// ===== User management (service role; owner-guarded) =====
export async function addUser(formData: FormData) {
  if (!(await callerIfOwner())) return;
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 6) return done();

  const admin = createAdminClient();
  // Creates the account directly (no email sent); the trigger makes the profile.
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  done();
}

export async function setRole(formData: FormData) {
  const caller = await callerIfOwner();
  if (!caller) return;
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (role !== "owner" && role !== "member") return;
  if (role === "member" && userId === caller.id) return done(); // no self-demote

  const admin = createAdminClient();
  // never demote the last owner
  if (role === "member" && (await roleOf(admin, userId)) === "owner" && (await ownerCount(admin)) <= 1) {
    return done();
  }
  await admin.from("core_profiles").update({ role }).eq("id", userId);
  done();
}

export async function setUserDisabled(formData: FormData) {
  const caller = await callerIfOwner();
  if (!caller) return;
  const userId = String(formData.get("user_id") ?? "");
  const disabled = String(formData.get("disabled") ?? "") === "1";
  if (disabled && userId === caller.id) return done(); // no self-lockout

  const admin = createAdminClient();
  if (disabled && (await roleOf(admin, userId)) === "owner" && (await ownerCount(admin)) <= 1) {
    return done(); // never disable the last owner
  }
  await admin.from("core_profiles").update({ disabled }).eq("id", userId);
  done();
}

export async function deleteUser(formData: FormData) {
  const caller = await callerIfOwner();
  if (!caller) return;
  const userId = String(formData.get("user_id") ?? "");
  if (userId === caller.id) return done(); // no self-delete

  const admin = createAdminClient();
  if ((await roleOf(admin, userId)) === "owner" && (await ownerCount(admin)) <= 1) {
    return done(); // never delete the last owner
  }
  // cascades to core_profiles + core_user_modules (FK on delete cascade)
  await admin.auth.admin.deleteUser(userId);
  done();
}

// ===== Module management (service role; owner-guarded) =====
export async function setModuleEnabled(formData: FormData) {
  if (!(await callerIfOwner())) return;
  const moduleId = String(formData.get("module_id") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "1";
  await createAdminClient().from("core_modules").update({ enabled }).eq("id", moduleId);
  doneWithLauncher();
}

export async function renameModule(formData: FormData) {
  if (!(await callerIfOwner())) return;
  const moduleId = String(formData.get("module_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return done();
  await createAdminClient().from("core_modules").update({ name }).eq("id", moduleId);
  doneWithLauncher();
}

export async function moveModule(formData: FormData) {
  if (!(await callerIfOwner())) return;
  const moduleId = String(formData.get("module_id") ?? "");
  const dir = String(formData.get("dir") ?? "");

  const admin = createAdminClient();
  const { data: mods } = await admin
    .from("core_modules")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });
  const list = mods ?? [];
  const i = list.findIndex((m) => m.id === moduleId);
  if (i === -1) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return done();

  // swap sort_order with the neighbour
  await admin.from("core_modules").update({ sort_order: list[j].sort_order }).eq("id", list[i].id);
  await admin.from("core_modules").update({ sort_order: list[i].sort_order }).eq("id", list[j].id);
  doneWithLauncher();
}
