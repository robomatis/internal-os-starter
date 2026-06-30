# Git, in three safe verbs

You don't need to master git. You need **three verbs and one rule.** Claude Code types the commands; you decide *when*.

## Your repo is yours

You made it with **"Use this template" → Create a new repository** (Private). Your GitHub account owns it. It holds your whole app **and its history** — every save point, kept.

## The three verbs

**1. commit = a save point.**
A commit is a labelled snapshot of the whole app at a moment it worked. Claude commits after each working step. Read them on github.com → your repo → **Commits** — each one is a moment you can return to.

**2. branch + preview = a safe place to try something risky.**
A branch is a parallel copy where you try a change without touching your live site.
> "Claude, make this change on a branch."

Push it → Vercel mints a **preview URL** (a private copy of your site with the change). Check it there. Happy? **Ask Claude to merge it into `main`** — a local merge, no pull request needed while you're solo. Now it's live.
Keep it simple: **one branch at a time, merge it the same session.**

**3. revert = go back to the last good save point.**
Something broke and you can't talk Claude back to working?
> "Claude, revert to the last commit where it worked, and show me."

`revert` adds a *new* commit that puts things back. It's always safe — it never erases.

## The one rule (MUST-NOT)

**Never `git reset --hard`, never `git push --force`.** They can destroy your history and your deploy, and you never need them — to undo, you **revert**. If Claude ever proposes either, say no.

## And never commit secrets

Your keys live in `.env.local` and in Vercel — never in the repo. `.gitignore` already keeps `.env*` out of GitHub. Leave it that way: a key committed once stays in the history forever.
