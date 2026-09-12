import { describe, expect, it } from "vitest";
import { getVenueAvailability, isCandidateSetComplete, isSelectable, MAX_CANDIDATES, toggleCandidate } from "./selection";
import type { Venue } from "@/types/group";
import type { Dish, MenuItem } from "@/types";

function dish(id: string): Dish {
  return {
    id,
    name: id,
    description: "",
    cuisine: "Fixture",
    ingredients: [],
    embedding: [],
    features: { sweet: 0, salty: 0, sour: 0, bitter: 0, umami: 0, spicy: 0, rich: 0, fresh: 0, crispy: 0, creamy: 0, chewy: 0, smoky: 0, cuisines: [], majorIngredients: [], proteinTypes: [], carbohydrateTypes: [], cookingMethods: [] },
  };
}

function menuItem(id: string): MenuItem {
  return { id, menuId: "menu-1", menuOrder: 0, price: 10, dish: dish(`dish-${id}`) };
}

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "v1",
    name: "Test Venue",
    location: { latitude: 40.44, longitude: -79.94 },
    menuItems: [menuItem("item-1")],
    menuFreshness: "fresh",
    ...overrides,
  };
}

describe("getVenueAvailability", () => {
  it("flags venues with no digitized dishes", () => {
    expect(getVenueAvailability(venue({ menuItems: [] }))).toBe("no-menu");
  });

  it("flags stale menu freshness", () => {
    expect(getVenueAvailability(venue({ menuFreshness: "stale" }))).toBe("stale");
  });

  it("reports a fully-formed, fresh venue as available", () => {
    expect(getVenueAvailability(venue())).toBe("available");
  });

  it("treats unknown freshness as available as long as dishes exist", () => {
    expect(getVenueAvailability(venue({ menuFreshness: "unknown" }))).toBe("available");
  });
});

describe("isSelectable", () => {
  it("allows available and stale venues", () => {
    expect(isSelectable(venue())).toBe(true);
    expect(isSelectable(venue({ menuFreshness: "stale" }))).toBe(true);
  });

  it("rejects venues with no menu", () => {
    expect(isSelectable(venue({ menuItems: [] }))).toBe(false);
  });
});

describe("toggleCandidate", () => {
  const venues = [venue({ id: "a" }), venue({ id: "b" }), venue({ id: "d", menuItems: [] })];

  it("adds a selectable venue not yet selected", () => {
    expect(toggleCandidate([], "a", venues)).toEqual(["a"]);
  });

  it("removes a venue already selected", () => {
    expect(toggleCandidate(["a", "b"], "a", venues)).toEqual(["b"]);
  });

  it("refuses to add a venue with no digitized menu", () => {
    expect(toggleCandidate([], "d", venues)).toEqual([]);
  });

  it("refuses to add beyond the max candidate cap", () => {
    const manyVenues = Array.from({ length: MAX_CANDIDATES + 1 }, (_, index) => venue({ id: `v${index}` }));
    const atCap = manyVenues.slice(0, MAX_CANDIDATES).map((entry) => entry.id);
    const overflowId = manyVenues[MAX_CANDIDATES].id;
    expect(toggleCandidate(atCap, overflowId, manyVenues)).toBe(atCap);
  });

  it("is a no-op (same reference) for an unknown venue id", () => {
    const selected = ["a"];
    expect(toggleCandidate(selected, "missing", venues)).toBe(selected);
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
