# Architecture (one page)

## The idea: a modular monolith

One application. One sign-in. Many **modules** (tools). One **admin** screen that
decides which user sees which module. Adding a tool is adding a folder — never a new
app, never a new deployment.

```
sign in  →  /home (launcher: only YOUR modules)
                │
                ├── /m/admin      ← owner-only: the user × module grid
                ├── /m/crm_demo   ← reads Intrix (read-only, mock fallback)
                └── /m/<your tool> ← scaffolded with /scaffold-module
```

## The four rails

1. **A module is a folder** — `modules/<id>/` + a `_registry.ts` entry + a `core_modules` row.
2. **Access is data, not code** — `core_user_modules` maps users → modules. `/m/[module]`
   checks it **server-side on every request**; the launcher shows only granted modules.
3. **Module tables are prefixed** — `crm_demo_*`. Each module's migrations live in its own
   `db/` folder with RLS. No module reads another module's tables.
4. **Admin is a module too** — granted only to seeded owners.

## Request flow for a module

```
/m/crm_demo
  → (app)/layout.tsx     : are you signed in?           (else → /login)
  → m/[module]/page.tsx  : are you GRANTED this module?  (else → "no access")
  → modules/crm_demo/pages.tsx renders
```

The guard is in one place. New modules add a `case` to the switch; they never touch
the guard.

## Where things live

- `modules/_registry.ts` — the list of modules (id, name, icon).
- `modules/<id>/` — `module.config.ts`, `pages.tsx`, `lib/`, `db/<id>_*.sql`.
- `app/m/[module]/page.tsx` — the router + access guard.
- `app/(app)/home/` — the launcher.
- `app/login/`, `lib/supabase/`, `lib/access.ts` — auth + access checks (pre-built).
- `supabase/migrations/0001_core.sql` — `core_profiles`, `core_modules`, `core_user_modules`,
  the `is_owner()` function, RLS, and the first-user-becomes-owner trigger.

## Why `is_owner()` is a database function

RLS policies need to ask "is the current user an owner?" — which means reading
`core_profiles` from inside a `core_profiles` policy. That recurses. The
`is_owner()` SECURITY DEFINER function reads the table without re-triggering RLS, so
the policies stay simple and safe.
