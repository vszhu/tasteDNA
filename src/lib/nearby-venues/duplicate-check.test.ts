import { describe, expect, it } from "vitest";
import type { Venue } from "@/types/group";
import { distanceMeters, DUPLICATE_DISTANCE_METERS, findDuplicateVenues } from "./duplicate-check";
import type { NearbyVenueInput } from "./types";

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "v1",
    name: "The Exchange",
    location: { latitude: 40.441354, longitude: -79.942125 },
    menuItems: [],
    menuFreshness: "unknown",
    ...overrides,
  };
}

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters({ lat: 40.44, lng: -79.94 }, { lat: 40.44, lng: -79.94 })).toBe(0);
  });

  it("is roughly correct for a known short distance", () => {
    // ~0.001 degrees latitude is about 111 meters.
    const distance = distanceMeters({ lat: 40.44, lng: -79.94 }, { lat: 40.441, lng: -79.94 });
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });
});

describe("findDuplicateVenues", () => {
  const existing = [venue({ id: "v1", name: "The Exchange", location: { latitude: 40.441354, longitude: -79.942125 } })];

  it("flags an exact case-insensitive name match regardless of location", () => {
    const input: NearbyVenueInput = { name: "the exchange", locationLabel: "Somewhere else", lat: 10, lng: 10 };
    expect(findDuplicateVenues(input, existing)).toHaveLength(1);
  });

  it("flags a pin within the duplicate distance threshold", () => {
    const input: NearbyVenueInput = { name: "Totally Different Name", locationLabel: "Nearby", lat: 40.4414, lng: -79.942125 };
    expect(distanceMeters(input, { lat: 40.441354, lng: -79.942125 })).toBeLessThan(DUPLICATE_DISTANCE_METERS);
    expect(findDuplicateVenues(input, existing)).toHaveLength(1);
  });

  it("does not flag a distinct venue far away with a different name", () => {
    const input: NearbyVenueInput = { name: "Brand New Cafe", locationLabel: "Far away", lat: 41, lng: -80 };
    expect(findDuplicateVenues(input, existing)).toHaveLength(0);
  });
});
