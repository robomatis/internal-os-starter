-- potni_nalogi module — database migration (travel orders + Google Maps distance).
-- Apply with:  npm run db:run -- modules/potni_nalogi/db/0001_potni_nalogi.sql
--
-- Same convention as ai_assist (register → grant → prefixed table + RLS). The km is
-- computed server-side via Google Maps (modules/potni_nalogi/lib/maps.ts) and stored here.

-- 1. Register + order the module.
insert into public.core_modules (id, name) values ('potni_nalogi', 'Potni nalogi')
  on conflict (id) do nothing;
update public.core_modules set sort_order = 4 where id = 'potni_nalogi';

-- 2. Grant to every existing owner (new users are handled by handle_new_user()).
insert into public.core_user_modules (user_id, module_id, granted_by)
  select id, 'potni_nalogi', id from public.core_profiles where role = 'owner'
  on conflict (user_id, module_id) do nothing;

-- 3. The module's data — prefixed table, RLS in the same migration.
create table if not exists public.potni_nalogi_zapisi (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stranka       text not null,
  kraj_od       text not null,
  kraj_do       text not null,
  datum         date not null,
  namen         text,
  km            numeric(10,1),                       -- driving distance from Google Maps
  distance_mock boolean not null default false,       -- true when km came from mock mode (no key)
  created_at    timestamptz not null default now()
);

alter table public.potni_nalogi_zapisi enable row level security;

drop policy if exists "potni_nalogi_zapisi: owner all" on public.potni_nalogi_zapisi;
create policy "potni_nalogi_zapisi: owner all"
  on public.potni_nalogi_zapisi for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
