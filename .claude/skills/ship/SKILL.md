---
name: ship
description: Close the loop — get the verified change live and confirm it actually works in production. Use when the user says "/ship", "deploy", "push it live", or after a passing /verify.
---

When invoked, get the change to a working public URL — and **confirm** it, don't assume it.

## Steps
1. Confirm `/verify` passed. If not, stop — `/debug` first.
2. Check **Workflow mode** in `CLAUDE.md` — *Pull requests: OFF* (default) or *ON*.
3. **PRs OFF (default):** commit + push to `main` → Vercel deploys `main` to production (~1 min). For a risky change, do it on a short-lived **branch** first (push → Vercel mints a **preview URL** → check there), then **merge it into `main` locally** (`git checkout main && git merge <branch> && git push`). **Do not open a pull request.**
   **PRs ON:** open a pull request with `gh pr create`, summarize the diff, use the branch's **preview URL** for review, and merge when checks pass. See `docs/workflow-mode.md`.
4. **Confirm the LIVE url:** open the production URL and check it loads (not a login/401 page), sign-in works, and the feature works.
5. **Public check:** if the URL shows a Vercel login / "Authenticate" page, Deployment Protection is on → *Vercel → Settings → Deployment Protection → turn off **Vercel Authentication*** so your pair can open it.
6. Report the live URL.
7. **Record the release.** Append `docs/features/<moduleId>/runs/<YYYY-MM-DD-HHMM>-ship.md` (live URL, commit ref — format in `docs/features/README.md`) and set the Card's `status: shipped` and `live_url`.

## Rules
- Production = `main`. Don't push broken code to `main` — that's what preview URLs are for.
- **Honor Workflow mode in `CLAUDE.md`. While pull requests are OFF, never open one** — merge branches into `main` locally and push.
- To undo a bad change, `git revert` to the last good commit — never `git reset --hard` or `git push --force`.
- Secrets live in Vercel env + `.env.local` only — never commit them.
- "Shipped" means you opened the live URL and it worked — not "the deploy finished."
