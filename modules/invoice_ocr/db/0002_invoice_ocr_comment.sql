-- invoice_ocr — add a per-invoice liquidation comment.
-- Apply with:  npm run db:run -- modules/invoice_ocr/db/0002_invoice_ocr_comment.sql
--
-- The comment is captured on the detail / review screen when you approve or reject an
-- invoice. One note per invoice. Idempotent (add column if not exists).
alter table public.invoice_ocr_invoices add column if not exists comment text;
