"use client";

import { useState } from "react";
import { Check, HelpCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PreferenceAnswer } from "./preference-question";
import type { PreferenceQuestion } from "@/types/group";

/**
 * Shown only when the group engine returns a `PreferenceQuestion` alongside
 * a close decision. Renders nothing for a robust (non-fragile) result —
 * callers can pass `question` straight through without a conditional.
 */
export function PreferenceQuestionCard({
  question,
  memberDisplayName,
  initialAnswer,
  onAnswer,
  successMessage = "Thanks — recommendation updated.",
}: {
  question: PreferenceQuestion | undefined;
  memberDisplayName: string;
  /** Seeds the answered state — e.g. when this scenario was already answered before switching away and back. */
  initialAnswer?: PreferenceAnswer;
  onAnswer: (answer: PreferenceAnswer) => void | Promise<void>;
  successMessage?: string;
}) {
  const [submitted, setSubmitted] = useState<PreferenceAnswer | null>(initialAnswer ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!question) return null;

  async function submit(answer: PreferenceAnswer) {
    if (submitted || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAnswer(answer);
      setSubmitted(answer);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t save that answer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-[var(--tomato)]/30 bg-[#fff8f6]">
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-xs font-bold tracking-[.14em] text-[var(--tomato)]"><HelpCircle className="size-3.5" /> ONE QUICK QUESTION FOR {memberDisplayName.toUpperCase()}</p>
        <p className="mt-3 text-lg">{question.prompt}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">This decision was close — your answer could change the pick.</p>

        {submitted ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#315e4b]"><Check className="size-4" /> {successMessage}</p>
        ) : (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit("yes")}
              className={cn("flex flex-1 items-center justify-center gap-2 rounded-full border border-[#4b8a70] bg-[#e5efe7] px-4 py-2.5 text-sm font-semibold text-[#315e4b] transition-transform active:scale-95")}
            >
              <ThumbsUp className="size-4" /> Yes
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit("no")}
              className={cn("flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold transition-transform active:scale-95")}
            >
              <ThumbsDown className="size-4" /> No
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}
