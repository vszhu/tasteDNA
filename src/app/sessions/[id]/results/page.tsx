"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Clock, RefreshCw, Sparkles, Users } from "lucide-react";
import { GroupResultsView } from "@/components/group/group-results-view";
import type { PreferenceAnswer } from "@/components/group/preference-question";
import { PreferenceQuestionCard } from "@/components/group/preference-question-card";
import { GroupMedicationCard } from "@/components/medications/group-medication-card";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { createGroupSessionClient, GroupSessionClientError } from "@/lib/group-sessions/client";
import type { GroupSessionDetail } from "@/lib/group-sessions/types";
import { EMPTY_MEAL_PREFERENCE_STATE, setTagPreference } from "@/lib/session/meal-preferences";
import { cn } from "@/lib/utils";
import { signInPath } from "@/lib/auth/callback";

const groupSessionClient = createGroupSessionClient();

function errorMessage(error: unknown, fallback: string) {
  return error instanceof GroupSessionClientError ? error.message : fallback;
}

export default function SessionResultsPage() {
  const { user, status } = useSession();
  const { id } = useParams<{ id: string }>();
  return <SessionResultsAccount key={`${status}:${user?.id ?? "anonymous"}:${id}`} />;
}

function SessionResultsAccount() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const { user, status } = useSession();
  const [detail, setDetail] = useState<GroupSessionDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await groupSessionClient.get(sessionId, signal);
      setDetail(next);
      setLoadError(null);
    } catch (error) {
      if (signal?.aborted) return;
      setDetail(null);
      setLoadError(errorMessage(error, "We couldn’t load this group result."));
    }
  }, [sessionId]);

  useEffect(() => {
    if (status !== "signed-in" || !user) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial authenticated API hydration
    void load(controller.signal);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, status, user]);

  const memberNames = useMemo(
    () => Object.fromEntries(detail?.members.map((member) => [member.userId, member.displayName]) ?? []),
    [detail],
  );

  async function compute() {
    setComputing(true);
    setActionError(null);
    try {
      const result = await groupSessionClient.compute(sessionId);
      setDetail((current) => current ? { ...current, latestRecommendation: result, recommendationNeedsRefresh: false, session: { ...current.session, status: "revealed" } } : current);
    } catch (error) {
      setActionError(errorMessage(error, "We couldn’t compute the group recommendation."));
    } finally {
      setComputing(false);
    }
  }

  async function answerQuestion(answer: PreferenceAnswer) {
    if (!detail?.latestRecommendation?.recommendation.preferenceQuestion || !user) return;
    const question = detail.latestRecommendation.recommendation.preferenceQuestion;
    const nextPreference = setTagPreference(
      detail.ownMealPreferenceState ?? EMPTY_MEAL_PREFERENCE_STATE,
      question.tag,
      answer === "yes" ? "desired" : "avoided",
    );
    const updated = await groupSessionClient.updateMealPreferences(sessionId, nextPreference);
    if (updated.session.createdByUserId === user.id) {
      const result = await groupSessionClient.compute(sessionId);
      setDetail({ ...updated, latestRecommendation: result, recommendationNeedsRefresh: false, session: { ...updated.session, status: "revealed" } });
    } else {
      setDetail(updated);
    }
  }

  if (status === "signed-out" || !user) {
    return <section className="mx-auto max-w-lg px-4 py-16 text-center"><Users className="mx-auto size-9 text-[var(--tomato)]" /><h1 className="mt-5 text-4xl">Sign in to see this result.</h1><Link href={signInPath(`/sessions/${sessionId}/results`)} className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>Sign in</Link></section>;
  }

  if (status === "loading" || detail === undefined) {
    return <div role="status" className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-[var(--muted)]">Loading the group result…</div>;
  }

  if (detail === null) {
    return <section className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-4xl">Result unavailable.</h1><p role="alert" className="mt-3 text-[var(--muted)]">{loadError ?? "You may not have access to this session."}</p><div className="mt-7 flex justify-center gap-3"><Button onClick={() => void load()}><RefreshCw className="size-4" /> Retry</Button><Link href={`/sessions/${sessionId}`} className={buttonVariants({ variant: "outline" })}>Back to session</Link></div></section>;
  }

  const isCreator = detail.session.createdByUserId === user.id;
  const myMember = detail.members.find((member) => member.userId === user.id);
  const canView = myMember?.status === "joined" || myMember?.status === "responded";
  const snapshot = detail.latestRecommendation;
  const question = snapshot?.recommendation.preferenceQuestion;
  const targetedToMe = question?.memberId === user.id;
  const currentAnswer: PreferenceAnswer | undefined = question && detail.ownMealPreferenceState?.desiredTags.includes(question.tag)
    ? "yes"
    : question && detail.ownMealPreferenceState?.avoidedTags.includes(question.tag)
      ? "no"
      : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-9 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/sessions/${sessionId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> Back to session</Link>
        <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="size-3.5" /> Refresh</Button>
      </div>

      <div className="mt-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">REAL GROUP RESULT</p><h1 className="mt-2 text-4xl sm:text-5xl">{detail.session.title}</h1></div>{isCreator && canView && <Button variant="accent" disabled={computing} onClick={() => void compute()}>{computing ? "Computing…" : snapshot ? "Recompute" : "Compute result"} <Sparkles className="size-4" /></Button>}</div>

      {canView && <GroupMedicationCard />}

      {actionError && <p role="alert" className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {actionError}</p>}

      {!canView ? (
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 text-center"><h2 className="text-2xl">Accept the invitation first.</h2><p className="mt-2 text-sm text-[var(--muted)]">Results are visible only to accepted members.</p><Link href={`/sessions/${sessionId}`} className={cn(buttonVariants({ variant: "accent" }), "mt-5")}>Open invitation</Link></div>
      ) : !snapshot ? (
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 text-center"><Clock className="mx-auto size-7 text-[var(--tomato)]" /><h2 className="mt-4 text-2xl">{detail.recommendationNeedsRefresh ? "This meal needs a fresh check." : "No result yet."}</h2><p className="mt-2 text-sm text-[var(--muted)]">{detail.recommendationNeedsRefresh ? "A saved list, group membership, or check coverage changed. Recompute before choosing a dish." : isCreator ? "Compute when the group is ready. Every accepted member needs a saved TasteDNA profile, and at least one candidate needs a shared menu." : "The creator will reveal the recommendation when everyone is ready."}</p></div>
      ) : (
        <>
          <p className="mt-6 text-xs text-[var(--muted)]">Computed {new Date(snapshot.computedAt).toLocaleString()} · {snapshot.algorithmVersion}</p>

          {question && targetedToMe && (
            <div className="mt-6"><PreferenceQuestionCard key={`${snapshot.id}:${currentAnswer ?? "unanswered"}`} question={question} memberDisplayName={memberNames[user.id] ?? "You"} initialAnswer={currentAnswer} onAnswer={answerQuestion} successMessage={isCreator ? "Saved — the recommendation was recomputed." : "Saved — ask the creator to recompute the result."} /></div>
          )}
          {question && !targetedToMe && <p className="mt-6 rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4 text-sm text-[#71561d]">This is a close decision. Waiting for {memberNames[question.memberId] ?? "a group member"} to answer one meal-preference question.</p>}

          <div className="mt-8"><GroupResultsView recommendation={snapshot.recommendation} memberNames={memberNames} /></div>
        </>
      )}
    </div>
  );
}
