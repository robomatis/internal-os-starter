---
name: debug
description: Find and fix the real cause when something breaks — without thrashing. Use when the user says "/debug", "it's broken", "this error", pastes an error, or after a failed /verify.
---

When invoked, work the problem methodically. The enemy is guessing and changing many things at once.

## Steps
1. **Reproduce** the exact failure — what action, what you expected, what actually happened.
2. **Read the real error** — don't paraphrase from memory. Get the actual text from:
   - the dev server or `npm run build` output, or
   - the **Vercel build log** (for a failed deploy), or
   - **Sentry** (for a live runtime error — it's already captured there), or
   - the browser console.
3. **Isolate** — narrow to the smallest cause. Form one hypothesis; change **one** thing.
4. **Fix** that one thing, then re-run `/verify`.

## Rules
- One variable at a time. If you change five things and it works, you've learned nothing.
- **Two failed attempts → STOP and reset:** restate the current state, the goal, and the problem; shrink to the smallest next step; try again. Don't spiral.
- Never disable a safety rail (RLS, auth, env-only secrets) just to "make it work."
- Paste the *actual* error to reason from — never debug from a remembered description.
- **If a change made it *worse* than a working state, go back — don't dig forward.**
  `git revert` to the last good commit (it adds a new commit that restores the working
  state; never `git reset --hard` or `git push --force`), then re-verify from there.
