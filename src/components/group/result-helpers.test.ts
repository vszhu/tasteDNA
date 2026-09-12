import { describe, expect, it } from "vitest";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import type { GroupRecommendation } from "@/types/group";
import { isNearTie, otherVenueScores, runnerUpGap, venueScoreFor } from "./result-helpers";

function recommendationFor(id: (typeof GROUP_GOLDEN_FIXTURES)[number]["id"]) {
  const fixture = GROUP_GOLDEN_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) throw new Error(`Missing fixture: ${id}`);
  const result = computeGroupRecommendation({ session: fixture.session, venues: fixture.venues, members: fixture.members });
  if (!result) throw new Error(`Fixture ${id} produced no recommendation`);
  return result;
}

describe("venueScoreFor", () => {
  it("finds the winner's own score entry", () => {
    const recommendation = recommendationFor("clear-winner");
    expect(venueScoreFor(recommendation, recommendation.winner.id)?.venue.id).toBe(recommendation.winner.id);
  });

  it("returns undefined for a venue id not in the candidate set", () => {
    const recommendation = recommendationFor("clear-winner");
    expect(venueScoreFor(recommendation, "not-a-real-venue")).toBeUndefined();
  });
});

describe("runnerUpGap / isNearTie", () => {
  it("is null when there is no runner-up", () => {
    const recommendation: GroupRecommendation = {
      ...recommendationFor("clear-winner"),
      runnerUp: undefined,
    };
    expect(runnerUpGap(recommendation)).toBeNull();
    expect(isNearTie(recommendation)).toBe(false);
  });

  it("reports a small gap as a near tie for the near-tie fixture", () => {
    const recommendation = recommendationFor("near-tie");
    const gap = runnerUpGap(recommendation);
    expect(gap).not.toBeNull();
    expect(isNearTie(recommendation)).toBe(true);
  });

  it("reports a large gap as not a near tie for the clear-winner fixture", () => {
    const recommendation = recommendationFor("clear-winner");
    expect(isNearTie(recommendation)).toBe(false);
  });
});

describe("otherVenueScores", () => {
  it("excludes the winner and includes every other candidate", () => {
    const recommendation = recommendationFor("misery-floor");
    const others = otherVenueScores(recommendation);
    expect(others.some((score) => score.venue.id === recommendation.winner.id)).toBe(false);
    expect(others.length).toBe(recommendation.venueScores.length - 1);
  });
});
