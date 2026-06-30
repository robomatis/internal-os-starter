---
name: plan
description: Shape a feature idea into a small, ordered build plan before any code. Use when the user says "/plan", "plan this", "I want to add…", or describes a feature or change. Writes no code.
---

When invoked, turn the user's idea into the smallest sensible plan — then stop. Do not write code; `/build` does that.

## Grill first (extract, don't assume)
Before planning, run **2–3 rounds of "grill me"** — **one sharp question at a time**,
each building on the last answer (never a wall of questions). Founders under-specify;
your job is to pull what's in their head onto the table. Keep going until you can state
the **input → process → output** concretely. Pick the angles that are still fuzzy:
- **Job:** what does this do for the user, in one sentence? What triggers it?
- **Input:** what goes in, and where from — a form field, a paste, this module's own data, an external system?
- **Process:** what happens to it — match, draft, classify, summarise? Is there a human approval step?
- **Output:** what comes out — a saved row, a draft, a table, a decision — and where does it show?
- **Who:** who should see this module? (members see only granted modules)
- **Done:** what would make you say "yes, that works"? Which edge cases actually matter?
- **Not now:** what's explicitly out of scope for the first version?

Stop when you have enough for a real first slice. Then **reflect the input → process →
output back in one line and get a "yes"** before writing the plan. Never guess a missing
fact — ask.

## Read for context
This repo's `CLAUDE.md` (the four rules), `docs/architecture.md`, and `PERSON.md` / `COMPANY.md` / `BRAND.md` if present.

## Output — a short plan, no code
- **Goal:** one sentence, in the user's words.
- **Module:** which module this belongs to. A new tool is a **new module** — plan to run `/scaffold-module`, never to hand-create folders.
- **First slice:** the smallest end-to-end piece worth seeing work (aim: done in one sitting).
- **Steps:** 3–6 ordered bullets — what changes and where (which `modules/<id>/` files).
- **Imitate:** the `crm_demo` module is the model (list/detail; read-only external data via `modules/crm_demo/lib/intrix.ts`).
- **Access:** who gets this module (it's granted in Admin; remember a member sees only granted modules).
- **Done when:** how you'll know it works (the check `/verify` will run).
- **Out of scope:** what you are NOT doing now.

## Artifact (write the plan down)
After showing the plan, **write it to `docs/features/<moduleId>/feature.md`** — the
Feature Card (format in `docs/features/README.md`). This is the source of truth `/build`
reads and the doc the founder edits to steer the work: fill Goal / What-it-does (I/O) /
Access / Done-when / Out-of-scope and set `status: planned`. If `/scaffold-module`
already created the Card, update it in place — don't duplicate.

## Rules
- Keep it to one screen. Long plan = slice too big — cut it.
- A plan never touches `app/login/`, `lib/`, or another module's folder.
- New data = a **prefixed** table (`<moduleId>_*`) **with RLS in the same migration**; note that in the plan.
- End by offering: *"Ready? `/build` the first slice."*
