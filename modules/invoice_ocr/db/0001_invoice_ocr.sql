-- invoice_ocr module — database migration (AI OCR + liquidation + CSV export).
-- Apply with:  npm run db:run -- modules/invoice_ocr/db/0001_invoice_ocr.sql
--
-- Same convention as ai_assist (register → grant → prefixed table + RLS), PLUS a
-- PRIVATE Storage bucket for the original invoice files. The bucket + its policies are
-- created here too. If your migration runner lacks rights on the `storage` schema,
-- create the bucket "invoice_ocr" (PRIVATE) and the four storage policies below once in
-- Supabase → Storage / SQL Editor instead. Safe to re-run (drop-if-exists guards).

-- 1. Register + order the module.
insert into public.core_modules (id, name) values ('invoice_ocr', 'Likvidacija računov')
  on conflict (id) do nothing;
update public.core_modules set sort_order = 3 where id = 'invoice_ocr';

-- 2. Grant to every existing owner (new users are handled by handle_new_user()).
insert into public.core_user_modules (user_id, module_id, granted_by)
  select id, 'invoice_ocr', id from public.core_profiles where role = 'owner'
  on conflict (user_id, module_id) do nothing;

-- 3. The module's data — prefixed table, RLS in the same migration.
create table if not exists public.invoice_ocr_invoices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_path      text not null,                       -- "<user_id>/<uuid>.<ext>" in the bucket
  file_mime      text not null,
  vendor         text,
  invoice_number text,
  issue_date     date,
  due_date       date,
  currency       text,
  net_amount     numeric(14,2),
  tax_amount     numeric(14,2),
  total_amount   numeric(14,2),
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  raw_json       jsonb,                                -- the model's raw output, for transparency
  extracted_mock boolean not null default false,       -- true when read in mock mode (no key)
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.invoice_ocr_invoices enable row level security;

drop policy if exists "invoice_ocr_invoices: owner all" on public.invoice_ocr_invoices;
create policy "invoice_ocr_invoices: owner all"
  on public.invoice_ocr_invoices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Storage: a PRIVATE bucket for the original files. The path starts with the owner's
--    id ("<user_id>/<uuid>.<ext>"), so the policies scope each user to their OWN folder —
--    the same owner-only isolation as the table's RLS above.
insert into storage.buckets (id, name, public) values ('invoice_ocr', 'invoice_ocr', false)
  on conflict (id) do nothing;

drop policy if exists "invoice_ocr storage: read own" on storage.objects;
create policy "invoice_ocr storage: read own"
  on storage.objects for select
  using (bucket_id = 'invoice_ocr' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "invoice_ocr storage: insert own" on storage.objects;
create policy "invoice_ocr storage: insert own"
  on storage.objects for insert
  with check (bucket_id = 'invoice_ocr' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "invoice_ocr storage: update own" on storage.objects;
create policy "invoice_ocr storage: update own"
  on storage.objects for update
  using (bucket_id = 'invoice_ocr' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "invoice_ocr storage: delete own" on storage.objects;
create policy "invoice_ocr storage: delete own"
  on storage.objects for delete
  using (bucket_id = 'invoice_ocr' and (storage.foldername(name))[1] = auth.uid()::text);
