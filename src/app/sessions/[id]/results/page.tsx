"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { GroupResultsView } from "@/components/group/group-results-view";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import { GROUP_GOLDEN_FIXTURES, type GroupGoldenFixture } from "@/types/group.fixtures";
import { cn } from "@/lib/utils";

const SCENARIO_LABELS: Record<GroupGoldenFixture["id"], string> = {
  "clear-winner": "Clear winner",
  "misery-floor": "Fairness saves the day",
  "near-tie": "Near tie",
  "stale-menu": "Stale menu",
  "preference-flip": "Meal preference flips the pick",
};

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
  const recommendation = useMemo(
    () => computeGroupRecommendation({ session: fixture.session, venues: fixture.venues, members: fixture.members }),
    [fixture],
  );
  const memberNames = useMemo(
    () => Object.fromEntries(fixture.members.map((decisionMember) => [decisionMember.member.userId, decisionMember.member.displayName])),
    [fixture],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-9 sm:px-6 sm:py-14">
      <Link href={`/sessions/${params.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> Back to session</Link>

      <p className="mt-6 flex items-center gap-2 rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4 text-sm text-[#71561d]">
        <Info className="size-4 shrink-0" /> Previewing the real ranking engine against a sample scenario — there&rsquo;s no reveal API yet to score your actual session.
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
