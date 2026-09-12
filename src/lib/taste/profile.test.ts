import { describe, expect, it } from "vitest";
import type { Dish, DishFeatures, Rating, TasteFeatureVector } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";
import { generateAttributePreferences, generateTasteVector } from "./profile";

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
});
