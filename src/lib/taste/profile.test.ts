import { describe, expect, it } from "vitest";
import type { Dish, DishFeatures, Rating, TasteFeatureVector } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";
import { buildTasteProfile, generateAttributePreferences, generatePreferenceRepresentations, generateTasteVector } from "./profile";

function features(values: Partial<TasteFeatureVector>): DishFeatures {
  return { ...Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, values[key] ?? 0])) as TasteFeatureVector, cuisines: ["Test"], majorIngredients: [], proteinTypes: [], carbohydrateTypes: [], cookingMethods: [] };
}
const dishes: Dish[] = [
  { id: "hot", name: "Hot", description: "", cuisine: "Test", ingredients: [], embedding: [1, 0], features: features({ spicy: 1, umami: .7 }) },
  { id: "sweet", name: "Sweet", description: "", cuisine: "Test", ingredients: [], embedding: [0, 1], features: features({ sweet: 1, creamy: .7 }) },
];
function rating(dishId: string, value: Rating["value"]): Rating { return { id: dishId, userId: "u", dishId, value, source: "onboarding", createdAt: "2026-01-01" }; }

describe("taste profile generation", () => {
  it("builds and normalizes a weighted semantic vector", () => {
    const vector = generateTasteVector([rating("hot", 5), rating("sweet", 1)], dishes);
    expect(vector[0]).toBeCloseTo(Math.SQRT1_2);
    expect(vector[1]).toBeCloseTo(-Math.SQRT1_2);
  });

  it("learns positive and negative attribute preferences", () => {
    const preferences = generateAttributePreferences([rating("hot", 5), rating("sweet", 1)], dishes);
    expect(preferences.spicy).toBeGreaterThan(0);
    expect(preferences.sweet).toBeLessThan(0);
  });

  it("keeps liked and disliked representations separate", () => {
    const representations = generatePreferenceRepresentations([rating("hot", 5), rating("sweet", 1)], dishes);
    expect(representations.positiveSemanticVector).toEqual([1, 0]);
    expect(representations.negativeSemanticVector).toEqual([0, 1]);
    expect(representations.positiveAttributePreferences.spicy).toBeGreaterThan(0);
    expect(representations.negativeAttributePreferences.sweet).toBeGreaterThan(0);
    expect(representations.positiveWeight).toBe(1);
    expect(representations.negativeWeight).toBe(1);
  });

  it("keeps zero and neutral ratings as an early, non-directional profile", () => {
    const profile = buildTasteProfile("u", [rating("hot", 3), rating("sweet", 3)], dishes);
    expect(profile.semanticVector).toEqual([0, 0]);
    expect(profile.attributePreferences.spicy).toBe(0);
    expect(profile.confidence).toBe("early read");
  });

  it("documents the profile confidence thresholds", () => {
    expect(buildTasteProfile("u", Array.from({ length: 9 }, (_, index) => rating(index % 2 ? "hot" : "sweet", 4)), dishes).confidence).toBe("early read");
    expect(buildTasteProfile("u", Array.from({ length: 10 }, (_, index) => rating(index % 2 ? "hot" : "sweet", 4)), dishes).confidence).toBe("taking shape");
    expect(buildTasteProfile("u", Array.from({ length: 18 }, (_, index) => rating(index % 2 ? "hot" : "sweet", 4)), dishes).confidence).toBe("well defined");
  });
});
