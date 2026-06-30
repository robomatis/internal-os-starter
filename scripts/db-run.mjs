// Apply a .sql migration to your Supabase project via the Management API, so
// Claude Code can run migrations for you — no pasting into the dashboard.
//
//   npm run db:run -- supabase/migrations/0001_init.sql
//
// Reads SUPABASE_ACCESS_TOKEN from your .env.local and derives the project ref
// from NEXT_PUBLIC_SUPABASE_URL. If the token is missing, it tells you how to
// run the SQL manually instead.
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
const file = process.argv[2];

if (!file) {
  console.error("usage: npm run db:run -- <path-to.sql>");
  process.exit(2);
}
if (!token || !ref) {
  console.error(
    "Can't auto-run: missing SUPABASE_ACCESS_TOKEN (or NEXT_PUBLIC_SUPABASE_URL) in .env.local.",
  );
  console.error(
    `Fallback — run it by hand: open Supabase → SQL Editor → paste ${file} → Run.`,
  );
  process.exit(1);
}

const query = readFileSync(file, "utf8");
const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);

if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  console.error(`✗ migration failed (HTTP ${res.status}): ${body.message ?? JSON.stringify(body)}`);
  process.exit(1);
}
console.log(`✓ applied ${file} to project ${ref}`);
