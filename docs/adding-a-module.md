# Adding a module

The supported way is the **`/scaffold-module`** skill — don't hand-create folders.
It exists so the rails (prefixes, RLS, registry, router) are followed automatically.

## What `/scaffold-module <id> "<Name>"` does

Example: `/scaffold-module leads "Leads"`

1. **Registry** — adds `{ id: "leads", name: "Leads", description, icon }` to
   `modules/_registry.ts`.
2. **Catalogue row** — has you run `insert into public.core_modules (id, name) values ('leads', 'Leads');`
3. **Folder** `modules/leads/`:
   - `module.config.ts`
   - `pages.tsx` — an async server component `<LeadsModule>` (starts from the `crm_demo` shape)
   - `db/0001_leads.sql` — a `leads_*` table stub **with RLS in the same file**
4. **Router** — adds `case "leads": return <LeadsModule />;` to `app/m/[module]/page.tsx`.
5. **Reminder** — grant yourself the module in **Admin** (`/m/admin`), then run the
   module's `db/` migration in Supabase.

## After scaffolding

- Run the new `db/0001_leads.sql` in Supabase (SQL Editor).
- `npm run lint && npm run build`.
- `/check-architecture` — confirms prefixes, RLS, no cross-module imports, registry consistency.

## Adding storage to a module

Put a migration in the module's `db/` folder. Every table name **must** start with the
module id, and RLS goes in the same file:

```sql
create table if not exists public.leads_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now()
);
alter table public.leads_items enable row level security;
create policy "leads_items: owner all" on public.leads_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Connecting an external API

Use **`/integrate-api`** — it copies the `crm_demo` Intrix pattern: a server-side client
reading from `process.env`, with a mock-mode fallback. Read before write.
