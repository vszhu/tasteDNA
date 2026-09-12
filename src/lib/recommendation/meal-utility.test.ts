import { describe, expect, it } from "vitest";
import { TASTE_DIMENSIONS } from "@/types";
import type { Dish, DishFeatures, MenuItem, TasteFeatureVector, TasteProfile } from "@/types";
import type { MealPreferenceState } from "@/types/group";
import { scoreCandidate } from "./scoring";
import { scoreDishForMeal } from "./meal-utility";

const EMPTY_MEAL_STATE: MealPreferenceState = {
  desiredTags: [],
  avoidedTags: [],
  excludedIngredients: [],
  excludedProteinTypes: [],
};

function features(values: Partial<TasteFeatureVector>, options: Partial<DishFeatures> = {}): DishFeatures {
  return {
    ...Object.fromEntries(TASTE_DIMENSIONS.map((dimension) => [dimension, values[dimension] ?? 0])) as TasteFeatureVector,
    cuisines: [],
    majorIngredients: [],
    proteinTypes: [],
    carbohydrateTypes: [],
    cookingMethods: [],
    ...options,
  };
}

function item(
  id: string,
  traits: Partial<TasteFeatureVector>,
  options: Partial<DishFeatures> = {},
  price: number | null = 10,
): MenuItem {
  const dish: Dish = {
    id,
    name: id,
    description: "",
    cuisine: "Test",
    ingredients: options.majorIngredients ?? [],
    embedding: [1, 0],
    features: features(traits, options),
  };
  return { id: `item-${id}`, menuId: "menu", menuOrder: 0, price, dish };
}

function profile(ratingCount = 1): TasteProfile {
  return {
    id: "profile",
    userId: "user",
    semanticVector: [1, 0],
    attributePreferences: Object.fromEntries(
      TASTE_DIMENSIONS.map((dimension) => [dimension, 0]),
    ) as TasteFeatureVector,
    cuisinePreferences: {},
    cookingMethodPreferences: {},
    favoriteCuisines: [],
    strongestPositiveFlavors: [],
    strongestNegativeFlavors: [],
    favoriteTextures: [],
    preferredCookingStyles: [],
    representativeDishIds: [],
    ratingCount,
    confidence: "early read",
    updatedAt: "2026-09-12",
  };
}

function score(menuItem: MenuItem, state: MealPreferenceState = EMPTY_MEAL_STATE, profileRatingCount = 1) {
  return scoreDishForMeal({
    memberId: "member",
    venueId: "venue",
    menuItem,
    profile: profile(profileRatingCount),
    mealPreferenceState: state,
  });
}

describe("meal-context dish utility", () => {
  it("matches the existing candidate score when no measurable meal preference exists", () => {
    const menuItem = item("baseline", { spicy: 0.4 });
    const utility = score(menuItem);
    expect(utility.utility).toBe(scoreCandidate(menuItem.dish, profile()).score);
    expect(utility.contextAdjustment).toBe(0);
  });

  it("adjusts spicy, light, comforting, filling, cheap, and quick preferences from available data", () => {
    const menuItem = item(
      "contextual",
      { spicy: 1, fresh: 0.9, rich: 0.1, creamy: 0.1, umami: 0.8, chewy: 0.7 },
      { cookingMethods: ["quick"] },
      4,
    );
    const desired = score(menuItem, { ...EMPTY_MEAL_STATE, desiredTags: ["spicy", "light", "comforting", "filling", "cheap", "quick"] });
    const desiredSpicy = score(menuItem, { ...EMPTY_MEAL_STATE, desiredTags: ["spicy"] });
    const avoidedSpicy = score(menuItem, { ...EMPTY_MEAL_STATE, avoidedTags: ["spicy"] });

    expect(desired.utility).toBeGreaterThanOrEqual(0);
    expect(desired.utility).toBeLessThanOrEqual(100);
    expect(desiredSpicy.utility).toBeGreaterThan(desiredSpicy.baseScore);
    expect(avoidedSpicy.utility).toBeLessThan(avoidedSpicy.baseScore);
    expect(desired.factors.filter((factor) => factor.kind === "meal-context")).toHaveLength(6);
  });

  it("does not infer quickness or price affinity when the menu data is absent", () => {
    const menuItem = item("unknown-data", {}, {}, null);
    const utility = score(menuItem, { ...EMPTY_MEAL_STATE, desiredTags: ["cheap", "quick"] });
    expect(utility.utility).toBe(utility.baseScore);
    expect(utility.factors).toHaveLength(1);
  });

  it("disqualifies ingredient, protein, and price-ceiling conflicts", () => {
    const ingredientConflict = score(item("peanut-dish", {}, { majorIngredients: ["peanut"] }), {
      ...EMPTY_MEAL_STATE,
      excludedIngredients: ["peanut"],
    });
    const proteinConflict = score(item("beef-dish", {}, { proteinTypes: ["beef"] }), {
      ...EMPTY_MEAL_STATE,
      excludedProteinTypes: ["beef"],
    });
    const priceConflict = score(item("expensive-dish", {}, {}, 20), {
      ...EMPTY_MEAL_STATE,
      maxPrice: 12,
    });

    for (const utility of [ingredientConflict, proteinConflict, priceConflict]) {
      expect(utility.excluded).toBe(true);
      expect(utility.utility).toBe(0);
      expect(utility.exclusionReason).toBeTruthy();
    }
  });

  it("keeps cold-start and all returned utilities bounded and deterministic", () => {
    const menuItem = item("cold-start", { spicy: 1 });
    const state: MealPreferenceState = { ...EMPTY_MEAL_STATE, desiredTags: ["spicy"] };
    const first = score(menuItem, state, 0);
    const second = score(menuItem, state, 0);

    expect(first).toEqual(second);
    expect(first.baseScore).toBe(50);
    expect(first.utility).toBeGreaterThan(50);
    expect(first.utility).toBeLessThanOrEqual(100);
  });
});
