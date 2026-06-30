# Workflow mode — solo by default, pull requests off

Your repo ships in **solo (trunk-based)** mode: the simplest flow for one founder building with an agent. You can turn on **pull requests (PRs)** later — here's what that means and how.

## Default: solo / trunk-based (Pull requests: OFF)

- `/build` makes a change and **commits** it (a save point).
- `/ship` **pushes to `main`** → Vercel deploys. Push = deploy.
- For a risky change, work on a short-lived **branch** to get a preview URL, check it, then **merge it into `main`** — ask Claude, it's a local merge (no PR). Delete the branch.
- To undo, **`git revert`** to the last good commit. Never `reset --hard` or force-push.

This is all you need while you're the only person on the repo.

## What a pull request is

A **pull request (PR)** is a *request to merge a branch into `main`*, with a review step in between: the change waits on its branch (with its preview URL) while someone reads the diff and approves — then it merges. It's how **teams** avoid pushing straight to the live branch — every change gets a second pair of eyes first.

As a solo founder you don't need that gate yet: you *are* the reviewer, and the preview URL already lets you see the change before it's live. PRs start paying off when **someone else joins the repo**, or when you want a deliberate review-before-deploy checkpoint.

## Turning pull requests ON

1. Open `CLAUDE.md` → the **Workflow mode** section.
2. Change `Pull requests: OFF` to `Pull requests: ON`.

From then on, `/ship` will **open a PR** (`gh pr create`) instead of pushing straight to `main`: it summarizes the diff, points you at the branch's preview URL for review, and merges when you approve. Everything else stays the same.

To go back to solo mode, set it to `OFF` again.
