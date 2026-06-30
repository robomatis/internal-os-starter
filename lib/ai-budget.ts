import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_DAILY_LIMIT = 20;

export class AiDailyLimitError extends Error {
  constructor(limit: number) {
    super(`Daily AI limit reached (${limit} calls).`);
    this.name = "AiDailyLimitError";
  }
}

function dailyLimit(): number {
  const raw = process.env.AI_DAILY_LIMIT_PER_USER;
  if (!raw) return DEFAULT_DAILY_LIMIT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_DAILY_LIMIT;
}

export async function recordAiUsage(
  supabase: SupabaseClient,
  feature: string,
) {
  if (!process.env.OPENROUTER_API_KEY) return;

  const limit = dailyLimit();
  const { data: recorded, error } = await supabase.rpc("record_core_ai_usage", {
    p_feature: feature,
    p_limit: limit,
  });
  if (error) throw error;
  if (recorded !== true) throw new AiDailyLimitError(limit);
}
