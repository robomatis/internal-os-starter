---
name: integrate-api
description: Add a read-only external API integration to a module, modeled on the Intrix reference. Use when the user says "/integrate-api", "connect an API", or wants a module to pull data from an external service.
---

When invoked, add a server-side API client to an existing module — read path first.

## Ask first (don't invent)
1. Which **module** this belongs to (it must already exist — run `/scaffold-module` first if not).
2. The API **base URL** and the **env var name** for its key (e.g. `ACME_API_KEY`, `ACME_BASE_URL`).
3. (Optional) a docs or OpenAPI URL to ground the request/response shape.

## Steps
1. Add the env var(s) to `.env.example` with a comment. Never hardcode the key.
2. Create `modules/<id>/lib/<service>.ts`: a server-side typed `fetch` using `process.env.<KEY>`, `cache: "no-store"`, **with a mock-mode fallback** — if the key is empty, serve bundled fixtures and return `mock: true`. Copy `modules/crm_demo/lib/intrix.ts`.
3. Add a UI slot in the module's `pages.tsx` that lists/shows the data and renders a "demo data" badge when `mock` is true.
4. **Read before write.** Writing back to the external API needs explicit owner approval in the spec — do not add write calls by default.

## Rules
- Server-side only — the key never reaches the browser.
- Mock mode must work with the key removed (it's the workshop fallback).
- After integrating, run `npm run lint && npm run build`, then `/check-architecture`.
