# Feature records — history, evidence, and the source of truth

Every build-loop skill (`/plan`, `/build`, `/verify`, `/ship`, `/integrate-ai`,
`/scaffold-module`) leaves a **document** behind. Together they form the paper
trail for each tool-module: what it's meant to do, what was actually built, and
proof it works — all in plain Markdown you can read, edit, and commit.

Why bother:

- **History / evidence.** It's in git, so you (and your team) can see what each
  module was supposed to do and that it was actually verified — not just "it
  should work."
- **Easy to review and modify.** It's a Markdown file. Open it, read it, change
  it. (`/zbi:visual-doc docs/features/<id>/feature.md` if you want a WYSIWYG
  view.)
- **The Card is the source of truth.** `/plan` writes it; `/build` reads it. Edit
  the Card and re-run a skill — the work follows the doc, not the other way round.

## Layout

One folder per module (the module **id** is the folder name):

```
docs/features/<id>/
  feature.md            ← the Feature Card: the spec + status. Human-editable.
  runs/
    2026-06-29-1402-build.md     ← one evidence file per skill run (append-only)
    2026-06-29-1510-verify.md
    2026-06-29-1533-ship.md
```

The **Card** stays clean and current. The **run files** accumulate as evidence —
never edit a past run; each is a snapshot of one execution.

## The Feature Card (`feature.md`)

```markdown
---
module: invoices          # the module id (= folder name, = table prefix)
title: Invoices
status: planned           # planned → built → verified → shipped
created: 2026-06-29
by: <your name>
verified_runs: 0          # how many times /verify passed (promotion gate)
live_url:                 # filled by /ship
---

# Invoices

## Goal
<one sentence, in your words — from /plan>

## What it does (input → process → output)
- **Input:** <a form field, or this module's own data>
- **Process:** <what happens — match, draft, classify, summarize…>
- **Output:** <a saved row, a draft, a table> — human approves at: <where>

## Access
Who gets this module (granted in Admin). Members see only granted modules.

## AI (only if this module uses /integrate-ai)
- **Capability:** draft | summarize | classify | answer
- **Prompt:** the exact system + input sent through `lib/ai.ts`.
  Edit this to change the behaviour, then re-run `/integrate-ai`.

## Done when
<the concrete check /verify will run>

## Out of scope
<what you are NOT doing yet>
```

## Run files (`runs/<timestamp>-<skill>.md`)

One short file per skill execution. Timestamp format: `YYYY-MM-DD-HHMM`.

```markdown
# <skill> — <module> — 2026-06-29 15:10

- **Skill:** /verify
- **What ran:** <slice built / flow walked / deploy>
- **Result:**
  - ✓ sign-in works; launcher shows the granted module
  - ✓ ungranted module URL refused server-side
  - ✗ member could still see admin link   ← any ✗ → /debug
- **Verdict:** PASS | FAIL
- **Ref:** commit abc1234 / live URL (if any)
```

## Which skill writes what

| Skill | Touches the Card | Appends a run file |
|---|---|---|
| `/scaffold-module` | creates `feature.md` (status: planned) if absent | — |
| `/plan` | writes Goal / I/O / Access / Done-when (status: planned) | — |
| `/build` | status → built | `runs/<ts>-build.md` (slice, files, commit) |
| `/integrate-ai` | fills the **AI** section (capability + the real prompt) | `runs/<ts>-integrate-ai.md` |
| `/verify` | status → verified; `verified_runs +1` on all-✓ | `runs/<ts>-verify.md` (the ✓/✗ evidence) |
| `/ship` | status → shipped; sets `live_url` | `runs/<ts>-ship.md` (live URL, commit) |

> **Promotion gate.** `verified_runs` is your codify-after-a-few-runs counter —
> the same rule as onboarding a new hire: prove the process a few times before
> you systematise it. Don't treat a module as "done and trusted" on one green run.
