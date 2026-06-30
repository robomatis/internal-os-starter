"use server";

// The AI module's write path — imitate this for an AI feature in any module:
// read input → call the LLM (server-side, via lib/ai.ts) → store the result in
// the module's PREFIXED, RLS-scoped table → revalidate. See /integrate-ai.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { userCanAccess } from "@/lib/access";
import { generate } from "@/lib/ai";
import { AiDailyLimitError, recordAiUsage } from "@/lib/ai-budget";

const AskSchema = z.object({
  question: z.string().min(1, "Ask a question first"),
});

export async function askAssistant(formData: FormData) {
  const parsed = AskSchema.safeParse({ question: formData.get("question") });
  if (!parsed.success) {
    redirect(`/m/ai_assist?error=${encodeURIComponent(parsed.error.issues[0]!.message)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Same server-side access check the router enforces — a member without the
  // module cannot drive its action by posting directly.
  if (!(await userCanAccess(supabase, user.id, "ai_assist"))) {
    redirect("/m/ai_assist?error=No+access");
  }

  let answer: string;
  try {
    await recordAiUsage(supabase, "ai_assist");
    const result = await generate({
      system:
        "You are a concise internal assistant for a startup. Answer in 3–5 sentences. If you don't know, say so.",
      prompt: parsed.data.question,
    });
    answer = result.text;
  } catch (e) {
    if (e instanceof AiDailyLimitError) {
      redirect("/m/ai_assist?error=Daily+AI+limit+reached.+Try+again+tomorrow.");
    }
    console.error("ai_assist generate failed", e);
    redirect("/m/ai_assist?error=AI+call+failed");
  }

  const { error } = await supabase.from("ai_assist_threads").insert({
    user_id: user.id,
    question: parsed.data.question,
    answer,
  });
  if (error) redirect(`/m/ai_assist?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/m/ai_assist");
  redirect("/m/ai_assist?ok=1");
}
