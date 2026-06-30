-- invoice_ocr — line items (postavke), normalized one row per line.
-- Apply with:  npm run db:run -- modules/invoice_ocr/db/0003_invoice_ocr_line_items.sql
--
-- Same convention as 0001/0002: prefixed table, RLS in this file, idempotent. A child of
-- invoice_ocr_invoices (FK + cascade). The status/note columns are here so a future task
-- can comment on a line or raise a dispute / reject a single line — no UI for them yet.
create table if not exists public.invoice_ocr_line_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoice_ocr_invoices (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  line_no      int  not null default 0,
  description  text,
  quantity     numeric(14,3),
  unit         text,                 -- enota mere (kos, h, kg, …)
  unit_price   numeric(14,2),
  net_amount   numeric(14,2),
  tax_rate     numeric(6,2),         -- DDV %
  tax_amount   numeric(14,2),
  total_amount numeric(14,2),
  status       text not null default 'ok' check (status in ('ok', 'disputed', 'rejected')), -- future: per-line dispute
  note         text,                                                                          -- future: per-line comment
  created_at   timestamptz not null default now()
);

create index if not exists invoice_ocr_line_items_invoice_id_idx
  on public.invoice_ocr_line_items (invoice_id);

alter table public.invoice_ocr_line_items enable row level security;

drop policy if exists "invoice_ocr_line_items: owner all" on public.invoice_ocr_line_items;
create policy "invoice_ocr_line_items: owner all"
  on public.invoice_ocr_line_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
