-- 0004_seeded_admin_bootstrap.sql - remove first-user-takes-owner bootstrap.
--
-- Apply after 0001_core.sql, 0002_admin.sql, and 0003_fix_profile_grants.sql.
-- Admin ownership now comes from scripts/seed-admin.mjs, not from public signup.

alter table public.core_profiles add column if not exists email text;
alter table public.core_profiles add column if not exists disabled boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.core_profiles (id, full_name, email, role, disabled)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'member',
    false
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.core_profiles.full_name),
        email = coalesce(excluded.email, public.core_profiles.email);

  -- No automatic module grants. Owners grant modules from Admin after seeding.
  return new;
end;
$$;
