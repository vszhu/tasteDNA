import type { GroupRecommendation, VenueGroupScore } from "@/types/group";

export const NEAR_TIE_THRESHOLD = 5;

/** Looks up a candidate's full score entry (winner, runner-up, or otherwise) by venue id. */
export function venueScoreFor(recommendation: GroupRecommendation, venueId: string): VenueGroupScore | undefined {
  return recommendation.venueScores.find((score) => score.venue.id === venueId);
}

/** Winner's groupScore minus the runner-up's, or null when there's no runner-up to compare. */
export function runnerUpGap(recommendation: GroupRecommendation): number | null {
  if (!recommendation.runnerUp) return null;
  const runnerUpScore = venueScoreFor(recommendation, recommendation.runnerUp.id);
  if (!runnerUpScore) return null;
  return recommendation.groupScore - runnerUpScore.groupScore;
}

/** A small gap between winner and runner-up means the choice was close, worth calling out. */
export function isNearTie(recommendation: GroupRecommendation): boolean {
  const gap = runnerUpGap(recommendation);
  return gap != null && gap <= NEAR_TIE_THRESHOLD;
}

/** Other candidates the group considered, ranked, excluding the winner. */
export function otherVenueScores(recommendation: GroupRecommendation): VenueGroupScore[] {
  return recommendation.venueScores.filter((score) => score.venue.id !== recommendation.winner.id);
}
