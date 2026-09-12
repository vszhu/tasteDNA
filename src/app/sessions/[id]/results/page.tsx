"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { GroupResultsView } from "@/components/group/group-results-view";
import { applyPreferenceAnswer, type PreferenceAnswer } from "@/components/group/preference-question";
import { PreferenceQuestionCard } from "@/components/group/preference-question-card";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import { EMPTY_MEAL_PREFERENCE_STATE } from "@/lib/session/meal-preferences";
import { GROUP_GOLDEN_FIXTURES, type GroupGoldenFixture } from "@/types/group.fixtures";
import type { GroupDecisionMember, PreferenceQuestion } from "@/types/group";
import { cn } from "@/lib/utils";

const SCENARIO_LABELS: Record<GroupGoldenFixture["id"], string> = {
  "clear-winner": "Clear winner",
  "misery-floor": "Fairness saves the day",
  "all-fail-compromise": "Best of a bad bunch",
  "near-tie": "Near tie",
  "stale-menu": "Stale menu",
  "preference-flip": "Meal preference flips the pick",
};

/**
 * A mock stand-in for the real engine's PreferenceQuestion output — the
 * engine never returns one today. Only the preference-flip scenario gets a
 * question, since it's the one fixture actually designed to change outcome
 * based on one member's answer (see group.fixtures.ts: winnerWithoutPreference
 * vs winnerWithPreference). Robust decisions never get a question, matching
 * "hide the component entirely for robust decisions."
 */
const MOCK_QUESTIONS: Partial<Record<GroupGoldenFixture["id"], PreferenceQuestion>> = {
  "preference-flip": { id: "q-preference-flip", memberId: "alex", tag: "spicy", prompt: "Feeling like something spicy today?" },
};

function initialMembers(fixture: GroupGoldenFixture, question: PreferenceQuestion | undefined): GroupDecisionMember[] {
  if (!question) return fixture.members;
  // Reset the targeted member's preferences so the demo starts unanswered,
  // instead of the fixture's already-flipped baseline.
  return fixture.members.map((decisionMember) =>
    decisionMember.member.userId === question.memberId
      ? { ...decisionMember, member: { ...decisionMember.member, mealPreferenceState: EMPTY_MEAL_PREFERENCE_STATE } }
      : decisionMember,
  );
}

/**
 * Presentation-only results view. There's no reveal API yet — and computing
 * a real group recommendation needs every member's private TasteProfile,
 * which shouldn't be resolved client-side anyway — so this previews the
 * real ranking engine (`computeGroupRecommendation`) against the shared
 * golden fixtures. Swap the fixture lookup for a fetch to the real reveal
 * endpoint once it exists; `GroupResultsView` itself needs no changes.
 */
export default function SessionResultsPage() {
  const params = useParams<{ id: string }>();
  const [scenarioId, setScenarioId] = useState<GroupGoldenFixture["id"]>("clear-winner");

  const fixture = useMemo(() => GROUP_GOLDEN_FIXTURES.find((entry) => entry.id === scenarioId)!, [scenarioId]);
  const question = MOCK_QUESTIONS[scenarioId];

  // Keyed per-scenario so switching scenarios and back preserves an answer,
  // and so no reset effect is needed when the scenario changes.
  const [answers, setAnswers] = useState<Partial<Record<GroupGoldenFixture["id"], PreferenceAnswer>>>({});
  const answer = answers[scenarioId];

  const baselineMembers = useMemo(() => initialMembers(fixture, question), [fixture, question]);
  const members: GroupDecisionMember[] = useMemo(
    () => (question && answer ? applyPreferenceAnswer(baselineMembers, question, answer) : baselineMembers),
    [baselineMembers, question, answer],
  );

  const recommendation = useMemo(() => computeGroupRecommendation({ session: fixture.session, venues: fixture.venues, members }), [fixture, members]);
  const memberNames = useMemo(() => Object.fromEntries(members.map((decisionMember) => [decisionMember.member.userId, decisionMember.member.displayName])), [members]);

  function handleAnswer(nextAnswer: PreferenceAnswer) {
    setAnswers((current) => ({ ...current, [scenarioId]: nextAnswer }));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-9 sm:px-6 sm:py-14">
      <Link href={`/sessions/${params.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> Back to session</Link>

      <p className="mt-6 flex items-center gap-2 rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4 text-sm text-[#71561d]">
        <Info className="size-4 shrink-0" /> Previewing the real ranking engine against a sample scenario — there&rsquo;s no reveal API yet to score your actual session. Group previews do not use medication lists. Medication checks apply to the solo menu decoder.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {GROUP_GOLDEN_FIXTURES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === scenarioId}
            onClick={() => setScenarioId(entry.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
              entry.id === scenarioId ? "border-[var(--tomato)] bg-[var(--tomato)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--ink)]",
            )}
          >
            {SCENARIO_LABELS[entry.id]}
          </button>
        ))}
      </div>

      {question && (
        <div className="mt-6">
          <PreferenceQuestionCard
            key={scenarioId}
            question={question}
            memberDisplayName={memberNames[question.memberId] ?? question.memberId}
            initialAnswer={answer}
            onAnswer={handleAnswer}
          />
        </div>
      )}

      <div className="mt-8">
        {recommendation ? (
          <GroupResultsView recommendation={recommendation} memberNames={memberNames} />
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
            None of this scenario&rsquo;s candidate venues have a digitized menu, so no recommendation could be computed.
          </div>
        )}
      </div>
    </div>
  );
}
