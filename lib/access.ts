// Module-access + identity helpers. Core — change with care.
// RLS guarantees a member only ever reads their own grants/profile; owners read
// all. These helpers also enforce access (enabled modules, not-disabled users).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getModule } from "@/modules/_registry";

export type Role = "owner" | "member";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  disabled: boolean;
};

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from("core_profiles")
    .select("id, full_name, email, role, disabled")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function isOwner(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const profile = await getProfile(supabase, userId);
  return profile?.role === "owner";
}

export async function getGrantedModuleIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("core_user_modules")
    .select("module_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.module_id as string);
}

export async function userCanAccess(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("core_user_modules")
    .select("module_id")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .maybeSingle();
  return !!data;
}

// Is a module switched on at the catalogue level? Disabled modules are blocked
// even for users who were granted them.
export async function moduleIsEnabled(
  supabase: SupabaseClient,
  moduleId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("core_modules")
    .select("enabled")
    .eq("id", moduleId)
    .maybeSingle();
  return data?.enabled === true;
}

// Owner view: every user (RLS lets owners read all profiles).
export async function listUsers(supabase: SupabaseClient): Promise<Profile[]> {
  const { data } = await supabase
    .from("core_profiles")
    .select("id, full_name, email, role, disabled, created_at")
    .order("created_at", { ascending: true });
  return (data as Profile[] | null) ?? [];
}

export type LauncherModule = {
  id: string;
  label: string;
  icon: string;
  description: string;
};

// What to show on a user's launcher: modules they are granted AND that are
// enabled, ordered by sort_order. Label comes from the DB (owner-editable);
// icon/description from the code registry.
export async function getLauncherModules(
  supabase: SupabaseClient,
  userId: string,
): Promise<LauncherModule[]> {
  const { data: grants } = await supabase
    .from("core_user_modules")
    .select("module_id")
    .eq("user_id", userId);
  const ids = (grants ?? []).map((g) => g.module_id as string);
  if (ids.length === 0) return [];

  const { data: mods } = await supabase
    .from("core_modules")
    .select("id, name, sort_order")
    .eq("enabled", true)
    .in("id", ids)
    .order("sort_order", { ascending: true });

  return (mods ?? []).flatMap((m) => {
    const def = getModule(m.id as string);
    return def
      ? [
          {
            id: m.id as string,
            label: (m.name as string) ?? def.name,
            icon: def.icon,
            description: def.description,
          },
        ]
      : [];
  });
}
