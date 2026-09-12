import { AlertTriangle, Award, Clock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isNearTie, otherVenueScores, runnerUpGap } from "./result-helpers";
import { DishIngredientDetails } from "./venue-ingredient-details";
import type { GroupRecommendation, VenueMenuFreshness } from "@/types/group";

const FRESHNESS_COPY: Record<VenueMenuFreshness, { label: string; className: string } | null> = {
  fresh: null,
  unknown: { label: "Menu freshness unverified", className: "text-[var(--muted)]" },
  stale: { label: "Menu data may be outdated", className: "text-[#a87a1f]" },
};

function StatTile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <p className="text-[10px] font-bold tracking-[.14em] text-[var(--muted)]">{label}</p>
      <p className="display mt-1 text-3xl">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-[var(--muted)]">{sublabel}</p>}
    </div>
  );
}

/**
 * Presentation-only: renders exactly the fields on a computed
 * `GroupRecommendation`, nothing invented client-side. Works the same
 * whether that recommendation came from a golden fixture or the real API.
 */
export function GroupResultsView({ recommendation, memberNames = {} }: { recommendation: GroupRecommendation; memberNames?: Record<string, string> }) {
  const winnerFreshness = FRESHNESS_COPY[recommendation.winner.menuFreshness];
  const gap = runnerUpGap(recommendation);
  const nearTie = isNearTie(recommendation);
  const others = otherVenueScores(recommendation);
  const medications = recommendation.medicationSummary;

  return (
    <div className="space-y-8">
      {medications && <section aria-label="Group medication coverage" className="rounded-2xl border border-[#d5dcd8] bg-[#eef2ec] p-5">
        <h3 className="text-sm font-bold">Private lists, shared meal guidance</h3>
        <p className="mt-2 text-sm leading-6">{medications.checkedMembers} of {medications.checkedMembers + medications.uncheckedMembers} members connected their saved medication settings.</p>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{medications.checkedMembers ? `${medications.flaggedDishOptions} dish–member options held for review; ${medications.withheldVenues} candidate venues withheld because someone had no eligible option. Medication names stay private.` : "No medication lists were applied to this result. Members can connect their own list from medication settings."} {medications.uncheckedMembers > 0 && `${medications.uncheckedMembers} members were not checked for medications.`}</p>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">These are selected food checks, not a safety clearance. Timing or portion questions may require review. Confirm ingredients and medication guidance before ordering; taste scores measure preferences.</p>
      </section>}
      <div className="relative overflow-hidden rounded-[1.8rem] bg-[var(--ink)] p-6 text-white sm:p-8">
        <p className="flex items-center gap-2 text-xs font-bold tracking-[.18em] text-[var(--saffron)]">
          <Award className="size-3.5" /> {recommendation.compromiseRequired ? "BEST COMPROMISE" : "THE GROUP’S PICK"}
        </p>
        <h2 className="mt-3 text-3xl sm:text-4xl">{recommendation.winner.name}</h2>
        {recommendation.winner.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{recommendation.winner.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge className="bg-white/10 text-white">Group score {recommendation.groupScore}</Badge>
          {nearTie && <Badge className="bg-white/10 text-[var(--saffron)]">Nearly tied{gap != null && ` · +${gap}`}</Badge>}
          {recommendation.compromiseRequired && <Badge className="bg-white/10 text-[#f0b3a3]">No venue satisfied everyone</Badge>}
          {winnerFreshness && <Badge className="bg-white/10 text-[#f0b3a3]">{winnerFreshness.label}</Badge>}
        </div>
        {recommendation.runnerUp && (
          <p className="mt-4 text-xs text-white/55">
            Runner-up: {recommendation.runnerUp.name}{gap != null && ` (${gap} points behind)`}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="GROUP AVERAGE" value={String(Math.round(recommendation.groupMeanUtility))} sublabel="Mean utility across everyone" />
        <StatTile label="WORST-MEMBER SAFEGUARD" value={String(Math.round(recommendation.worstMemberUtility))} sublabel={`Misery floor: ${recommendation.miseryFloor}`} />
        <StatTile label="MEMBERS" value={String(recommendation.assignments.length)} sublabel="Contributed to this pick" />
      </div>

      <section>
        <h3 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">EVERYONE&rsquo;S DISH</h3>
        <div className="mt-3 space-y-3">
          {recommendation.assignments.map((assignment) => {
            const { dishUtility } = assignment;
            const name = memberNames[assignment.memberId] ?? assignment.memberId;
            return (
              <Card key={assignment.memberId}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold tracking-[.12em] text-[var(--muted)]">{name.toUpperCase()}</p>
                      <h4 className="mt-1 text-xl">{dishUtility.dish.name}</h4>
                    </div>
                    <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--cream)] text-sm font-bold">{dishUtility.utility}</div>
                  </div>
                  <div className="mt-3"><DishIngredientDetails dish={dishUtility.dish} /></div>
                  {dishUtility.excluded ? (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--tomato)]"><AlertTriangle className="size-3.5" /> {dishUtility.exclusionReason ?? "Excluded by this meal's preferences"}</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dishUtility.factors.map((factor, index) => (
                        <span
                          key={`${factor.label}-${index}`}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            factor.contribution >= 0 ? "bg-[#e8f0e9] text-[#315e4b]" : "bg-[#f2ede5] text-[var(--muted)]",
                          )}
                        >
                          {factor.contribution >= 0 ? "+" : "–"} {factor.label}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {others.length > 0 && (
        <section>
          <h3 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">OTHER VENUES CONSIDERED</h3>
          <div className="mt-3 space-y-2">
            {others.map((score) => (
              <div key={score.venue.id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
                <div>
                  <p className="font-semibold">{score.venue.name}</p>
                  {!score.clearsMiseryFloor && <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[var(--tomato)]"><AlertTriangle className="size-3 shrink-0" /> Below the misery floor for at least one member</p>}
                  {FRESHNESS_COPY[score.venue.menuFreshness] && <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)]"><Clock className="size-3 shrink-0" /> {FRESHNESS_COPY[score.venue.menuFreshness]!.label}</p>}
                </div>
                <span className="shrink-0 text-sm font-bold text-[var(--muted)]">{score.groupScore}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendation.decisionConfidence && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-bold"><Info className="size-4 text-[var(--tomato)]" /> Decision confidence: {recommendation.decisionConfidence.level}</p>
          {recommendation.decisionConfidence.isFragile && <p className="mt-1 text-xs text-[var(--muted)]">This pick is close enough that one person&rsquo;s answer could flip it.</p>}
        </section>
      )}
    </div>
  );
}
