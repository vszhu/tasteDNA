import { describe, expect, it } from "vitest";
import { CMU_DINING_LAST_GOOD } from "./fixture";
import { deterministicVenueId, normalizeCmuLocation } from "./normalize";

const SYNCED_AT = "2026-09-12T12:00:00.000Z";

describe("CMU Dining normalization", () => {
  it("creates stable venue IDs from the CMU concept ID", () => {
    const venue = normalizeCmuLocation(CMU_DINING_LAST_GOOD.locations[0], SYNCED_AT);

    expect(venue?.externalId).toBe("cmu:92");
    expect(venue?.id).toBe(deterministicVenueId("cmu:92"));
    expect(deterministicVenueId("cmu:92")).toBe(deterministicVenueId("cmu:92"));
  });

  it("falls back to the upstream record ID when a concept ID is absent", () => {
    const location = { ...CMU_DINING_LAST_GOOD.locations[0], conceptId: null };
    const venue = normalizeCmuLocation(location, SYNCED_AT);

    expect(venue?.externalId).toBe(`cmu:id:${location.id}`);
  });

  it("normalizes hours and changes the content hash when hours change", () => {
    const start = Date.UTC(2026, 8, 12, 14);
    const first = normalizeCmuLocation(
      { ...CMU_DINING_LAST_GOOD.locations[0], times: [{ start, end: start + 3_600_000 }] },
      SYNCED_AT,
    );
    const changed = normalizeCmuLocation(
      { ...CMU_DINING_LAST_GOOD.locations[0], times: [{ start, end: start + 7_200_000 }] },
      SYNCED_AT,
    );

    expect(first?.hours).toEqual([
      { start: "2026-09-12T14:00:00.000Z", end: "2026-09-12T15:00:00.000Z" },
    ]);
    expect(first?.contentHash).not.toBe(changed?.contentHash);
  });

  it("skips records without usable coordinates", () => {
    const location = { ...CMU_DINING_LAST_GOOD.locations[0], coordinateLat: null };
    expect(normalizeCmuLocation(location, SYNCED_AT)).toBeNull();
  });
});
