-- ai_assist module — database migration (the AI worked example).
-- Apply with:  npm run db:run -- modules/ai_assist/db/0001_ai_assist.sql
--
-- Shows the convention for a module that DOES store data AND calls an LLM:
--   1. Register the module in core_modules (so the access grid + launcher see it).
--   2. Grant it to existing owners (new owners get it automatically).
--   3. The module's own table is PREFIXED (ai_assist_*) with RLS in this same file.

-- 1. Register + order the module.
insert into public.core_modules (id, name) values ('ai_assist', 'AI Assistant')
  on conflict (id) do nothing;
update public.core_modules set sort_order = 2 where id = 'ai_assist';

-- 2. Grant to every existing owner (new users are handled by handle_new_user()).
insert into public.core_user_modules (user_id, module_id, granted_by)
  select id, 'ai_assist', id from public.core_profiles where role = 'owner'
  on conflict (user_id, module_id) do nothing;

-- 3. The module's data — prefixed table, RLS in the same migration.
create table if not exists public.ai_assist_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question   text not null,
  answer     text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_assist_threads enable row level security;

create policy "ai_assist_threads: owner all"
  on public.ai_assist_threads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
