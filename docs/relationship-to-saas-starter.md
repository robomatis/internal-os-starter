# How this relates to the SaaS starter (Day 2 → Day 3)

The whole point of the build track: **Day 3 should feel like Day 2 plus one concept.**
This repo is deliberately the SaaS starter's sibling — almost everything is identical,
and the new surface is small and nameable: **modules**.

## Identical (copied verbatim — confidence carry-over)

If a founder learned it on Day 2, it works exactly the same on Day 3:

| Thing | Files | Notes |
|---|---|---|
| Stack | — | Next.js 15, React 19, TS strict, Tailwind 4, npm |
| Sign-in | `app/login/`, `lib/supabase/{client,server,middleware}.ts`, `middleware.ts` | Email + password, email-confirmation OFF, server-action forms. **Byte-for-byte the same**, except sign-in lands on `/home` instead of `/dashboard`. |
| Env style | `.env.example` | Same Supabase/Resend/Sentry contract + comments; Intrix vars appended. |
| Error tracking | `instrumentation*.ts`, `sentry.*.config.ts`, `app/global-error.tsx`, `next.config.ts` | Identical Sentry wiring. |
| Email | `lib/email.ts` | Same Resend wrapper. |
| UI + brand tokens | `components/ui/*`, `components/footer.tsx`, `app/globals.css`, `app/layout.tsx` | Same primitives and rebrandable CSS variables. |
| RLS discipline | every migration | "Every table enables RLS in the same migration" — same rule, applied per module. |
| Build/verify | — | `npm run lint && npm run build`; same harmless Supabase Edge warning. |

The shared auth + Supabase layer is intentionally frozen so the two repos never drift.

## The one new concept: modules

Everything different exists to support "one app, many tools, one sign-in, controlled access":

| Day 2 (SaaS) | Day 3 (Internal OS) | Why |
|---|---|---|
| One product, one feature (`requests`) | Many **modules** behind one sign-in | A company system is several tools, not one. |
| `app/(app)/dashboard` + `feature/` | `app/(app)/home` launcher + `app/m/[module]` router | The launcher shows only your modules; the router is the single access guard. |
| `profiles` + `requests` tables | `core_profiles` (with **role**) + `core_modules` + `core_user_modules` | Access becomes data: who-sees-what is rows, not code. |
| Auth guard only | Auth guard **+ per-module access check** | A member can't reach a module by URL. |
| No admin | **Admin module** — the user × module checkbox grid | "The difference between a toy and a company system." |
| Tables: `requests` | Tables: **prefixed per module** (`crm_demo_*`) | Data never blurs across modules. |
| — | An **external API** integration (`crm_demo` → Intrix, read-only, mock fallback) | The skill founders can't easily self-teach. |
| `CLAUDE.md` rails | `CLAUDE.md` rails **+ 3 in-repo skills** (`/scaffold-module`, `/check-architecture`, `/integrate-api`) | The "Compound Engineering variation": best practices pre-applied so the agent builds inside the rails. |

## The teaching arc

- **Day 2** proves: *I can ship a real, secure app I own.*
- **Day 3** proves: *I can grow it into a system of tools with controlled access — and the
  agent stays on the rails because the rails are written into the repo.*

The closing Day-3 block names this explicitly: the architecture skills you used all day
are the Compound-Engineering idea, pre-applied to this repo.
