import { describe, expect, it } from "vitest";
import { GROUP_GOLDEN_FIXTURES } from "./group.fixtures";

describe("group-domain golden fixtures", () => {
  it("covers every required MVP decision scenario", () => {
    expect(GROUP_GOLDEN_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "clear-winner",
      "misery-floor",
      "all-fail-compromise",
      "near-tie",
      "stale-menu",
      "preference-flip",
    ]);
  });

  it("keeps candidate venues, members, and expected outcomes internally consistent", () => {
    for (const fixture of GROUP_GOLDEN_FIXTURES) {
      const venueIds = new Set(fixture.venues.map((venue) => venue.id));
      expect(venueIds.has(fixture.expected.winnerVenueId)).toBe(true);
      expect(fixture.session.candidateVenueIds.every((id) => venueIds.has(id))).toBe(true);
      expect(fixture.members.every(({ member }) => member.sessionId === fixture.session.id)).toBe(true);
      expect(fixture.members.every(({ member }) => member.mealPreferenceState.desiredTags.every(
        (tag) => !member.mealPreferenceState.avoidedTags.includes(tag),
      ))).toBe(true);
    }
  });

  it("marks stale data and a preference-driven winner flip explicitly", () => {
    const staleMenu = GROUP_GOLDEN_FIXTURES.find((fixture) => fixture.id === "stale-menu");
    const preferenceFlip = GROUP_GOLDEN_FIXTURES.find((fixture) => fixture.id === "preference-flip");

    expect(staleMenu?.expected.staleVenueIds).toEqual(["stale-choice"]);
    expect(staleMenu?.venues.find((venue) => venue.id === "stale-choice")?.menuFreshness).toBe("stale");
    expect(preferenceFlip?.expected.winnerWithoutPreferenceId).not.toBe(
      preferenceFlip?.expected.winnerWithPreferenceId,
    );
  });

  it("declares the intended misery-floor and compromise expectations", () => {
    const miseryFloor = GROUP_GOLDEN_FIXTURES.find((fixture) => fixture.id === "misery-floor");
    const allFail = GROUP_GOLDEN_FIXTURES.find((fixture) => fixture.id === "all-fail-compromise");

    expect(miseryFloor?.expected).toMatchObject({
      failingVenueIds: ["one-member-miss"],
      compromiseRequired: false,
    });
    expect(allFail?.expected).toMatchObject({
      failingVenueIds: ["least-bad", "bad-fit"],
      compromiseRequired: true,
    });
  });
});
