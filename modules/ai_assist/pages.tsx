import { createClient } from "@/lib/supabase/server";
import { aiConfigured } from "@/lib/ai";
import { askAssistant } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The AI worked example: ask → LLM (lib/ai.ts → OpenRouter) → store in a prefixed,
// RLS-scoped table → list. Imitate this shape for an AI feature in your own module.
export async function AiAssistModule() {
  const supabase = await createClient();
  // RLS scopes ai_assist_threads to the signed-in user.
  const { data } = await supabase
    .from("ai_assist_threads")
    .select("id, question, answer, created_at")
    .order("created_at", { ascending: false });
  const threads = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          {aiConfigured() ? null : <Badge variant="secondary">mock mode</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask a question; the AI answers and the Q&amp;A is saved (owner-only via RLS).
          The reference for{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/integrate-ai</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ask</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={askAssistant} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="question">Your question</Label>
              <textarea
                id="question"
                name="question"
                required
                rows={3}
                placeholder="e.g. Draft a short follow-up to a pilot customer who went quiet."
                className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <SubmitButton pendingText="Asking…">Ask the assistant</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">History</h2>
        {threads.length > 0 ? (
          <div className="space-y-3">
            {threads.map((t) => (
              <Card key={t.id} size="sm">
                <CardContent className="space-y-2">
                  <div className="font-medium">{t.question}</div>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {t.answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No questions yet. Ask your first one above.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
