---
name: check-architecture
description: Audit the current changes against this repo's modular-monolith rules. Use when the user says "/check-architecture", after scaffolding a module, or before committing.
---

When invoked, review the working changes (run `git diff` and read the changed files) and report violations of the architecture rules — each with the file/line and a concrete fix.

## Check
1. **Prefixes** — every new table in any `modules/*/db/*.sql` is named `<moduleId>_*`. Flag a bare table (e.g. `contacts` inside `crm_demo` instead of `crm_demo_contacts`).
2. **RLS present** — every new table enables RLS and has owner-scoped policies in the same migration.
3. **No cross-module imports** — no file under `modules/<a>/` imports from `modules/<b>/`. Modules share nothing but their own data.
4. **No secrets in code** — no API keys/tokens hardcoded; secrets come from `process.env` only; nothing prefixed `NEXT_PUBLIC_` is a server secret.
5. **Registry consistency** — every `modules/<id>/` has a `_registry.ts` entry, a `core_modules` row, and a `case` in `app/m/[module]/page.tsx`.

## Output
A short report: ✓ for each rule that passes; for each failure, the exact path/line and the fix. End with **PASS** or a numbered list of must-fixes. Do not edit files unless the user asks.

## Rules
- Be specific — cite path and line. Don't invent violations; if a rule passes, say so plainly.
