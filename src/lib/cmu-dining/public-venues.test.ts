import { describe, expect, it } from "vitest";
import { lastGoodPublicVenues, storedVenueToPublicVenue } from "./public-venues";
import type { StoredVenueRow } from "./types";

const row: StoredVenueRow = {
  id: "067ed794-7748-567a-8092-f383f2bf374c",
  external_id: "cmu:92",
  source: "cmu-eats",
  name: "The Exchange",
  address_label: "Posner Hall",
  latitude: 40.441354,
  longitude: -79.942125,
  hours: [],
  menu_url: null,
  specials: [],
  soups: [],
  source_metadata: {
    shortDescription: "Campus deli",
    acceptsOnlineOrders: false,
  },
  content_hash: "hash",
  source_updated_at: null,
  synced_at: "2026-09-12T12:00:00.000Z",
  is_active: true,
};

describe("public venue mapping", () => {
  it("maps persisted rows into the shared Venue contract", () => {
    expect(storedVenueToPublicVenue(row)).toEqual({
      id: row.id,
      name: "The Exchange",
      description: "Campus deli",
      location: { label: "Posner Hall", latitude: 40.441354, longitude: -79.942125 },
      menuItems: [],
      menuFreshness: "unknown",
      acceptsOnlineOrders: false,
    });
  });

  it("does not expose rows with incomplete coordinate pairs", () => {
    expect(storedVenueToPublicVenue({ ...row, longitude: null })).toBeNull();
  });

  it("provides valid shared venue objects from the checked-in fallback", () => {
    const venues = lastGoodPublicVenues();
    expect(venues.length).toBeGreaterThan(0);
    expect(venues[0]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      menuItems: [],
      menuFreshness: "unknown",
    }));
  });
});
