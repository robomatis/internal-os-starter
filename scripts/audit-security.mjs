import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

const raw = result.stdout || result.stderr || "{}";
let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error(raw);
  process.exit(result.status ?? 1);
}

const counts = report.metadata?.vulnerabilities ?? {};
const high = counts.high ?? 0;
const critical = counts.critical ?? 0;
const moderate = counts.moderate ?? 0;

console.log(`npm audit: ${critical} critical, ${high} high, ${moderate} moderate.`);
if (moderate > 0) {
  console.log("Moderate advisories are tracked in docs/security.md; high/critical fail this check.");
}

if (high > 0 || critical > 0) {
  process.exit(1);
}
