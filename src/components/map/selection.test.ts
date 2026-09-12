import { describe, expect, it } from "vitest";
import { getVenueAvailability, isCandidateSetComplete, isSelectable, MAX_CANDIDATES, toggleCandidate } from "./selection";
import type { VenueSummary } from "./venue-types";

const NOW = new Date("2026-09-15T12:00:00.000Z");

function venue(overrides: Partial<VenueSummary> = {}): VenueSummary {
  return {
    id: "v1",
    name: "Test Venue",
    shortDescription: "",
    locationLabel: "",
    coordinates: { lat: 40.44, lng: -79.94 },
    dishCount: 5,
    acceptsOnlineOrders: false,
    lastSyncedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("getVenueAvailability", () => {
  it("flags missing coordinates", () => {
    expect(getVenueAvailability(venue({ coordinates: null }), NOW)).toBe("missing-location");
  });

  it("flags venues with no digitized dishes", () => {
    expect(getVenueAvailability(venue({ dishCount: 0 }), NOW)).toBe("no-menu");
  });

  it("flags data synced more than 24h ago as stale", () => {
    const staleTimestamp = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString();
    expect(getVenueAvailability(venue({ lastSyncedAt: staleTimestamp }), NOW)).toBe("stale");
  });

  it("flags a venue that has never synced as stale", () => {
    expect(getVenueAvailability(venue({ lastSyncedAt: null }), NOW)).toBe("stale");
  });

  it("reports a fully-formed, freshly-synced venue as available", () => {
    expect(getVenueAvailability(venue(), NOW)).toBe("available");
  });
});

describe("isSelectable", () => {
  it("allows available and stale venues", () => {
    expect(isSelectable(venue(), NOW)).toBe(true);
    const staleTimestamp = new Date(NOW.getTime() - 48 * 60 * 60 * 1000).toISOString();
    expect(isSelectable(venue({ lastSyncedAt: staleTimestamp }), NOW)).toBe(true);
  });

  it("rejects venues missing a location or a menu", () => {
    expect(isSelectable(venue({ coordinates: null }), NOW)).toBe(false);
    expect(isSelectable(venue({ dishCount: 0 }), NOW)).toBe(false);
  });
});

describe("toggleCandidate", () => {
  const venues = [venue({ id: "a" }), venue({ id: "b" }), venue({ id: "c", coordinates: null }), venue({ id: "d", dishCount: 0 })];

  it("adds a selectable venue not yet selected", () => {
    expect(toggleCandidate([], "a", venues, NOW)).toEqual(["a"]);
  });

  it("removes a venue already selected", () => {
    expect(toggleCandidate(["a", "b"], "a", venues, NOW)).toEqual(["b"]);
  });

  it("refuses to add a venue with missing coordinates", () => {
    expect(toggleCandidate([], "c", venues, NOW)).toEqual([]);
  });

  it("refuses to add a venue with no digitized menu", () => {
    expect(toggleCandidate([], "d", venues, NOW)).toEqual([]);
  });

  it("refuses to add beyond the max candidate cap", () => {
    const manyVenues = Array.from({ length: MAX_CANDIDATES + 1 }, (_, index) => venue({ id: `v${index}` }));
    const atCap = manyVenues.slice(0, MAX_CANDIDATES).map((entry) => entry.id);
    const overflowId = manyVenues[MAX_CANDIDATES].id;
    expect(toggleCandidate(atCap, overflowId, manyVenues, NOW)).toBe(atCap);
  });

  it("is a no-op (same reference) for an unknown venue id", () => {
    const selected = ["a"];
    expect(toggleCandidate(selected, "missing", venues, NOW)).toBe(selected);
  });
});

describe("isCandidateSetComplete", () => {
  it("requires between 3 and 5 candidates", () => {
    expect(isCandidateSetComplete([])).toBe(false);
    expect(isCandidateSetComplete(["a", "b"])).toBe(false);
    expect(isCandidateSetComplete(["a", "b", "c"])).toBe(true);
    expect(isCandidateSetComplete(["a", "b", "c", "d", "e"])).toBe(true);
    expect(isCandidateSetComplete(["a", "b", "c", "d", "e", "f"])).toBe(false);
  });
});
