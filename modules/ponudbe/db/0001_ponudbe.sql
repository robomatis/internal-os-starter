-- ponudbe module — database migration (e-pošta → klasifikacija → ZOHO → ponudba).
-- Apply with:  npm run db:run -- modules/ponudbe/db/0001_ponudbe.sql
--
-- Same convention as invoice_ocr (register → grant → prefixed tables + RLS), PLUS a
-- PRIVATE Storage bucket for the generated quote PDFs. If your migration runner lacks
-- rights on the `storage` schema, create the bucket "ponudbe" (PRIVATE) and the four
-- storage policies below once in Supabase → Storage / SQL Editor instead.
-- Safe to re-run (if-not-exists + drop-if-exists guards).

-- 1. Register + order the module.
insert into public.core_modules (id, name) values ('ponudbe', 'Ponudbe')
  on conflict (id) do nothing;
update public.core_modules set sort_order = 4 where id = 'ponudbe';

-- 2. Grant to every existing owner (new users are handled by handle_new_user()).
insert into public.core_user_modules (user_id, module_id, granted_by)
  select id, 'ponudbe', id from public.core_profiles where role = 'owner'
  on conflict (user_id, module_id) do nothing;

-- 3a. Ingested + classified emails (the inbox). message_id is the Graph id and the
--     idempotency key for sync (re-sync never duplicates a message).
create table if not exists public.ponudbe_emails (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message_id      text not null,                       -- Microsoft Graph message id
  from_email      text,
  from_name       text,
  subject         text,
  received_at     timestamptz,
  body_text       text,
  classification  text not null default 'unclassified'
                    check (classification in ('unclassified', 'quote_request', 'spam', 'other')),
  classify_reason text,
  classify_mock   boolean not null default false,
  status          text not null default 'new'
                    check (status in ('new', 'quoted', 'dismissed')),
  created_at      timestamptz not null default now(),
  unique (user_id, message_id)
);

alter table public.ponudbe_emails enable row level security;
drop policy if exists "ponudbe_emails: owner all" on public.ponudbe_emails;
create policy "ponudbe_emails: owner all"
  on public.ponudbe_emails for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3b. Quote header. zoho_quote_id is set after a successful write-back and also acts as
--     the idempotency guard (we only POST to ZOHO when it is null).
create table if not exists public.ponudbe_quotes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email_id       uuid references public.ponudbe_emails (id) on delete set null,
  customer_name  text,
  customer_email text,
  zoho_contact_id text,
  currency       text not null default 'EUR',
  net_amount     numeric(14,2),
  tax_amount     numeric(14,2),
  total_amount   numeric(14,2),
  status         text not null default 'draft'
                   check (status in ('draft', 'sent')),
  zoho_quote_id  text,                                 -- set after write-back; null = not yet pushed
  pdf_path       text,                                 -- "<user_id>/<uuid>.pdf" in the bucket
  draft_subject  text,
  draft_body     text,
  compose_mock   boolean not null default false,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.ponudbe_quotes enable row level security;
drop policy if exists "ponudbe_quotes: owner all" on public.ponudbe_quotes;
create policy "ponudbe_quotes: owner all"
  on public.ponudbe_quotes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3c. Quote line items (matched products). sku may be null when the model could not
--     match a requested item to the catalogue — the human resolves it before push.
create table if not exists public.ponudbe_quote_items (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.ponudbe_quotes (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  line_no         int not null default 0,
  requested_text  text,                                -- the original ask, verbatim
  sku             text,
  zoho_product_id text,
  product_name    text,
  description     text,
  quantity        numeric(14,3),
  unit            text,
  unit_price      numeric(14,2),
  net_amount      numeric(14,2),
  tax_rate        numeric(5,2),                         -- DDV %
  confidence      numeric(4,3),                         -- 0..1 match confidence
  created_at      timestamptz not null default now()
);

alter table public.ponudbe_quote_items enable row level security;
drop policy if exists "ponudbe_quote_items: owner all" on public.ponudbe_quote_items;
create policy "ponudbe_quote_items: owner all"
  on public.ponudbe_quote_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Storage: a PRIVATE bucket for the generated quote PDFs. The path starts with the
--    owner's id ("<user_id>/<uuid>.pdf"), so the policies scope each user to their OWN
--    folder — the same owner-only isolation as the tables' RLS above.
insert into storage.buckets (id, name, public) values ('ponudbe', 'ponudbe', false)
  on conflict (id) do nothing;

drop policy if exists "ponudbe storage: read own" on storage.objects;
create policy "ponudbe storage: read own"
  on storage.objects for select
  using (bucket_id = 'ponudbe' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ponudbe storage: insert own" on storage.objects;
create policy "ponudbe storage: insert own"
  on storage.objects for insert
  with check (bucket_id = 'ponudbe' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ponudbe storage: update own" on storage.objects;
create policy "ponudbe storage: update own"
  on storage.objects for update
  using (bucket_id = 'ponudbe' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ponudbe storage: delete own" on storage.objects;
create policy "ponudbe storage: delete own"
  on storage.objects for delete
  using (bucket_id = 'ponudbe' and (storage.foldername(name))[1] = auth.uid()::text);
