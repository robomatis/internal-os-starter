---
name: verify
description: Prove the change actually works — run it and exercise the module, including access control. Use when the user says "/verify", "does it work", "test it", or after /build. Reports concrete pass/fail.
---

When invoked, don't *say* it works — *show* it. Run the app, walk the real flow, and check access control, then report what you observed.

## Steps
1. `npm run lint && npm run build` — must be green.
2. Run `/check-architecture` — prefixes, RLS present, no cross-module imports, no hardcoded secrets, registry consistent.
3. Run the app (`npm run dev`, or the deployed URL) and walk the flow:
   - Sign in works; the launcher shows the module; the module does its job (saves/reads).
4. **Access-control checks (the heart of this app):**
   - As the **owner**, grant a **member** exactly one module in Admin.
   - As that member, confirm the launcher shows **only** that module, and visiting an **ungranted** module's URL is **refused** server-side.
   - Confirm a member **cannot** grant modules (owner-only).
5. Report a checklist of ✓ / ✗ with what you actually saw — not "should work."
6. **Save the evidence.** Append `docs/features/<moduleId>/runs/<YYYY-MM-DD-HHMM>-verify.md` with that ✓/✗ checklist and a PASS/FAIL verdict (format in `docs/features/README.md`). On all-✓, set the Card's `status: verified` and bump `verified_runs` by 1 — that counter is the gate before you treat the module as trusted.

## Rules
- "Works" means you ran it and watched it happen — including the member's restricted view.
- Any ✗ → hand to `/debug`. Don't ship a failing build or a broken access check.
- All ✓ → suggest *"`/ship` it."*
