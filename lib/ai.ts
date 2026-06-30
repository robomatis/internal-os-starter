// The system's AI calls go through here. SERVER-ONLY.
//
// Uses OpenRouter via the OpenAI-compatible SDK — the SAME capped key your Hermes
// agent uses, so no new account. Default model is Claude; set OPENROUTER_MODEL to
// switch (e.g. an OpenAI model) — the call shape never changes.
//
// SECURITY: OPENROUTER_API_KEY is server-only — never NEXT_PUBLIC, never in the
// browser. Only call generate() from Server Actions / route handlers.
//
// Imitate this for an AI module: build a prompt (optionally from a module's own
// data), call generate(), store the result in the module's prefixed RLS table,
// render it. The ai_assist module is the worked example. Use /integrate-ai.
import "server-only";
import OpenAI from "openai";
import { spawn } from "node:child_process";

// Cheap + fast default for a workshop (the key is capped). Verify the current slug
// at openrouter.ai/models; bump to a stronger Claude model if you want.
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-haiku";

// Which engine answers generate():
//   "openrouter" (default) — pay-as-you-go API via the capped OpenRouter key.
//   "local-claude"         — offload to the local Claude Code CLI (`claude -p`):
//                            your Claude SUBSCRIPTION answers — no API key, no
//                            per-token spend. Works only where `claude` is
//                            installed + logged in (your own machine), so use it
//                            for local single-player dev; leave it unset on a
//                            deployed server (Vercel) and it uses OpenRouter.
// Set AI_BACKEND in .env.local.
const BACKEND = process.env.AI_BACKEND ?? "openrouter";

/** True when an engine can answer for real (an API key, or the local Claude CLI). */
export function aiConfigured(): boolean {
  return BACKEND === "local-claude" || Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * One LLM call: text in, text out. No key set (first local run, CI, or a founder
 * who hasn't added one yet) → mock mode, so the module still works end-to-end with
 * zero spend. Same idea as the Intrix mock fallback.
 */
export async function generate(params: {
  prompt: string;
  system?: string;
  model?: string;
}): Promise<{ text: string; mock: boolean }> {
  if (BACKEND === "local-claude") {
    return generateViaLocalClaude(params);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { text: mockOutput(), mock: true };
  }

  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });

  const res = await client.chat.completions.create({
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: 500,
    messages: [
      ...(params.system
        ? [{ role: "system" as const, content: params.system }]
        : []),
      { role: "user" as const, content: params.prompt },
    ],
  });

  return { text: res.choices[0]?.message?.content?.trim() ?? "", mock: false };
}

/**
 * Offload one call to the local Claude Code CLI (`claude -p`). Your Claude
 * SUBSCRIPTION answers — no API key, no per-token billing (while Anthropic keeps
 * headless `claude -p` on subscription billing). If `claude` isn't installed /
 * logged in, or it errors, we fall back to mock so the module still works.
 *
 * SECURITY: the (untrusted) prompt is written to the child's STDIN, never passed
 * as an argv element — so a prompt that starts with "-" can't be smuggled in as a
 * claude flag (argv injection). Only fixed flags are passed as args. We also scrub
 * ANTHROPIC_API_KEY from the child env — if set, Claude Code bills pay-as-you-go
 * API instead of the subscription (a documented surprise-bill footgun). Needs the
 * Node.js runtime, not Edge — Server Actions run on Node by default.
 */
function generateViaLocalClaude(params: {
  prompt: string;
  system?: string;
}): Promise<{ text: string; mock: boolean }> {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force subscription auth, never pay-as-you-go

  const input = params.system
    ? `${params.system}\n\n---\n\n${params.prompt}`
    : params.prompt;

  // Optional: point AI_BRAIN_DIR at a company-brain folder and Claude auto-loads
  // that folder's CLAUDE.md / PERSON / COMPANY / BRAND as grounding. Omit to run
  // without it (don't point it at this app's root — that loads the dev rules).
  const cwd = process.env.AI_BRAIN_DIR || undefined;

  return new Promise((resolve) => {
    const mock = () => resolve({ text: mockOutput(), mock: true });
    // Only FIXED flags are argv; the prompt goes on stdin (see SECURITY above).
    const child = spawn("claude", ["-p", "--output-format", "text"], { env, cwd });
    let out = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); mock(); }, 120_000);
    child.stdout.on("data", (d) => {
      out += d.toString();
      if (out.length > 8 * 1024 * 1024) child.kill("SIGKILL"); // cap runaway output
    });
    child.on("error", () => { clearTimeout(timer); mock(); }); // claude not installed
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve({ text: out.trim(), mock: false });
      else mock(); // not logged in / non-zero / empty → mock
    });
    child.stdin.on("error", () => {}); // ignore EPIPE if the child exits early
    child.stdin.end(input);
  });
}

function mockOutput(): string {
  return "[mock AI — set OPENROUTER_API_KEY in .env.local for real output] This is a placeholder answer so the module works without a key. With a key, your question is answered by Claude via OpenRouter.";
}
