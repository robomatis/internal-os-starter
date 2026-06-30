-- 0005_ai_usage.sql - DB-backed per-user daily AI call budget.
--
-- The app inserts one row before each real OpenRouter call. Mock mode does not
-- insert rows. RLS lets users see/insert only their own usage.

create table if not exists public.core_ai_usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  feature    text not null,
  created_at timestamptz not null default now()
);

create index if not exists core_ai_usage_events_user_day_idx
  on public.core_ai_usage_events (user_id, usage_date);

alter table public.core_ai_usage_events enable row level security;

drop policy if exists "core_ai_usage_events: owner select" on public.core_ai_usage_events;
create policy "core_ai_usage_events: owner select"
  on public.core_ai_usage_events for select
  using (auth.uid() = user_id);

drop policy if exists "core_ai_usage_events: owner insert" on public.core_ai_usage_events;
create policy "core_ai_usage_events: owner insert"
  on public.core_ai_usage_events for insert
  with check (auth.uid() = user_id);

create or replace function public.record_core_ai_usage(
  p_feature text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_usage_date date := current_date;
  v_limit integer := greatest(coalesce(p_limit, 20), 0);
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize this user's daily budget check so parallel requests cannot overrun it.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(v_usage_date::text));

  select count(*) into v_count
  from public.core_ai_usage_events
  where user_id = v_user_id
    and usage_date = v_usage_date;

  if v_count >= v_limit then
    return false;
  end if;

  insert into public.core_ai_usage_events (user_id, usage_date, feature)
  values (v_user_id, v_usage_date, coalesce(nullif(p_feature, ''), 'unknown'));

  return true;
end;
$$;

revoke all on function public.record_core_ai_usage(text, integer) from public;
grant execute on function public.record_core_ai_usage(text, integer) to authenticated;
