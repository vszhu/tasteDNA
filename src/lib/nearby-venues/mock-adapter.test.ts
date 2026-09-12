import { describe, expect, it } from "vitest";
import type { Venue } from "@/types/group";
import { mockNearbyVenuesAdapter } from "./mock-adapter";

function existingVenue(): Venue {
  return { id: "v1", name: "The Exchange", location: { latitude: 40.441354, longitude: -79.942125 }, menuItems: [], menuFreshness: "unknown" };
}

describe("mockNearbyVenuesAdapter", () => {
  it("rejects invalid input without creating anything", async () => {
    const result = await mockNearbyVenuesAdapter.createNearbyVenue({ name: "", locationLabel: "Somewhere", lat: 1, lng: 1 }, []);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a missing coordinate as invalid", async () => {
    const result = await mockNearbyVenuesAdapter.createNearbyVenue({ name: "Cafe", locationLabel: "Somewhere", lat: Number.NaN, lng: 1 }, []);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("warns about a duplicate instead of creating", async () => {
    const result = await mockNearbyVenuesAdapter.createNearbyVenue({ name: "The Exchange", locationLabel: "Somewhere", lat: 1, lng: 1 }, [existingVenue()]);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "duplicate") expect(result.matches).toHaveLength(1);
  });

  it("creates anyway when forced past a duplicate warning", async () => {
    const result = await mockNearbyVenuesAdapter.createNearbyVenue({ name: "The Exchange", locationLabel: "Somewhere", lat: 1, lng: 1 }, [existingVenue()], { force: true });
    expect(result.ok).toBe(true);
  });

  it("creates a new venue and it is returned by listNearbyVenues afterward", async () => {
    const created = await mockNearbyVenuesAdapter.createNearbyVenue({ name: `Unique Cafe ${Date.now()}`, locationLabel: "123 Forbes Ave", lat: 40.4, lng: -79.9 }, []);
    expect(created.ok).toBe(true);
    const list = await mockNearbyVenuesAdapter.listNearbyVenues();
    if (created.ok) expect(list.some((venue) => venue.id === created.venue.id)).toBe(true);
  });
});
