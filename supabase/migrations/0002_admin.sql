-- 0002_admin.sql — user & module management (Admin v2).
-- Apply with:  npm run db:run -- supabase/migrations/0002_admin.sql

-- ===========================================================================
-- core_profiles: add email + disabled; capture email on signup;
-- and CLOSE a self-escalation hole (a member could previously PATCH their own
-- row to role='owner' via the data API, since RLS is row-level not column-level).
-- ===========================================================================
alter table public.core_profiles add column if not exists email    text;
alter table public.core_profiles add column if not exists disabled boolean not null default false;

-- backfill email for existing users
update public.core_profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- new signups also capture email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare is_first boolean;
begin
  select count(*) = 0 into is_first from public.core_profiles;
  insert into public.core_profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    case when is_first then 'owner' else 'member' end
  );
  if is_first then
    insert into public.core_user_modules (user_id, module_id, granted_by)
    select new.id, id, new.id from public.core_modules;
  end if;
  return new;
end; $$;

-- A user can still update their own full_name (self-update policy from 0001),
-- but NOT role / disabled / email. Those change only via the admin server
-- actions (service role). Column-level revoke is what RLS can't express.
revoke update (role, disabled, email) on public.core_profiles from authenticated;

-- ===========================================================================
-- core_modules: ordering. (label = name, and `enabled` already exist from 0001.)
-- Owners edit enabled/name/sort_order via the admin actions (service role);
-- no data-API write policy is added, so members have no module-write path.
-- ===========================================================================
alter table public.core_modules add column if not exists sort_order int not null default 0;
update public.core_modules set sort_order = 0 where id = 'admin';
update public.core_modules set sort_order = 1 where id = 'crm_demo';
