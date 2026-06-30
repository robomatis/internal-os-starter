-- 0003_fix_profile_grants.sql — actually close the self-escalation hole.
--
-- 0002 used column-level REVOKE, which is ineffective while `authenticated` still
-- holds a TABLE-level UPDATE grant (a table grant covers every column). The fix:
-- drop the table-level UPDATE, then grant UPDATE on ONLY full_name. After this a
-- user can rename themselves but cannot change their own role/disabled/email via
-- the data API. Owners change role/disabled through the admin actions (secret key).
revoke update on public.core_profiles from authenticated;
revoke update on public.core_profiles from anon;
grant  update (full_name) on public.core_profiles to authenticated;
