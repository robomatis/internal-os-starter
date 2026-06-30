-- 0001_core.sql — the core of the modular monolith.
-- Run once: Supabase → SQL Editor → paste → Run.
--
-- THREE CORE TABLES (all prefixed `core_`):
--   core_profiles      — one row per user, with a role (owner | member)
--   core_modules       — the catalogue of tool-modules (mirrors modules/_registry.ts)
--   core_user_modules  — which user can see which module (access is DATA, not code)
--
-- Module access is enforced server-side on every request AND by RLS here.
-- Rule for this repo: every module's own tables are prefixed with the module id
-- (e.g. crm_demo_*) and ship their RLS in the module's own db/ migration.

-- ===========================================================================
-- core_profiles
-- ===========================================================================
create table if not exists public.core_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

alter table public.core_profiles enable row level security;

-- is_owner(): SECURITY DEFINER so policies can check ownership WITHOUT causing
-- RLS recursion on core_profiles. Defined AFTER core_profiles exists — a SQL
-- function's body is validated at creation, so the table must already be there.
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.core_profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

create policy "core_profiles: self or owner read"
  on public.core_profiles for select
  using (auth.uid() = id or public.is_owner());

create policy "core_profiles: self update"
  on public.core_profiles for update
  using (auth.uid() = id);

-- ===========================================================================
-- core_modules — the module catalogue (keep in sync with modules/_registry.ts)
-- ===========================================================================
create table if not exists public.core_modules (
  id      text primary key,
  name    text not null,
  enabled boolean not null default true
);

alter table public.core_modules enable row level security;

create policy "core_modules: authenticated read"
  on public.core_modules for select
  using (auth.uid() is not null);

-- Seed the catalogue. Adding a module later: insert a row here + a _registry.ts entry.
insert into public.core_modules (id, name) values
  ('admin',    'Admin'),
  ('crm_demo', 'CRM (demo)')
on conflict (id) do nothing;

-- ===========================================================================
-- core_user_modules — the access grid (user × module). Access is data.
-- ===========================================================================
create table if not exists public.core_user_modules (
  user_id    uuid not null references auth.users (id) on delete cascade,
  module_id  text not null references public.core_modules (id) on delete cascade,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

alter table public.core_user_modules enable row level security;

-- A user reads their own grants; owners read everyone's (to drive the admin grid).
create policy "core_user_modules: self or owner read"
  on public.core_user_modules for select
  using (auth.uid() = user_id or public.is_owner());

-- Only owners grant or revoke.
create policy "core_user_modules: owner insert"
  on public.core_user_modules for insert
  with check (public.is_owner());

create policy "core_user_modules: owner delete"
  on public.core_user_modules for delete
  using (public.is_owner());

-- ===========================================================================
-- New-user handling: the FIRST registered user becomes the owner and is granted
-- every module; everyone after is a member with no grants until the owner adds them.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.core_profiles;

  insert into public.core_profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case when is_first then 'owner' else 'member' end
  );

  if is_first then
    insert into public.core_user_modules (user_id, module_id, granted_by)
    select new.id, id, new.id from public.core_modules;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
