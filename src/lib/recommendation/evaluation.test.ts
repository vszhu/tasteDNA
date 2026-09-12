import { describe, expect, it } from "vitest";
import type { Dish, DishFeatures, MenuItem, Rating, TasteFeatureVector } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";
import { evaluateCosineBaseline, splitHeldOutRatings } from "./evaluation";

function features(): DishFeatures {
  return {
    ...Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, 0])) as TasteFeatureVector,
    cuisines: [], majorIngredients: [], proteinTypes: [], carbohydrateTypes: [], cookingMethods: [],
  };
}
function dish(id: string, embedding: number[]): Dish {
  return { id, name: id, description: "", cuisine: "Test", ingredients: [], embedding, features: features() };
}
function rating(id: string, value: Rating["value"], createdAt: string): Rating {
  return { id: `r-${id}-${createdAt}`, userId: "u", dishId: id, value, source: "onboarding", createdAt };
}

describe("cosine baseline evaluation", () => {
  const dishes = [dish("liked-train", [1, 0]), dish("liked-held-out", [1, 0]), dish("disliked-held-out", [-1, 0])];
  const items: MenuItem[] = dishes.map((item, menuOrder) => ({ id: `m-${item.id}`, menuId: "m", menuOrder, dish: item }));

  it("holds out the latest positive and negative interactions without leakage", () => {
    const split = splitHeldOutRatings([
      rating("liked-train", 5, "2026-01-01"),
      rating("liked-held-out", 5, "2026-01-02"),
      rating("disliked-held-out", 1, "2026-01-03"),
    ]);
    expect(split.train.map((entry) => entry.dishId)).toEqual(["liked-train"]);
    expect(split.heldOutPositive.map((entry) => entry.dishId)).toEqual(["liked-held-out"]);
    expect(split.heldOutNegative.map((entry) => entry.dishId)).toEqual(["disliked-held-out"]);
  });

  it("reports ranking metrics for the retained cosine baseline", () => {
    const result = evaluateCosineBaseline([{
      id: "u",
      ratings: [rating("liked-train", 5, "2026-01-01"), rating("liked-held-out", 5, "2026-01-02"), rating("disliked-held-out", 1, "2026-01-03")],
    }], dishes, items);
    expect(result.hitAt1).toBe(1);
    expect(result.hitAt3).toBe(1);
    expect(result.ndcgAt3).toBe(1);
    expect(result.meanReciprocalRank).toBe(1);
    expect(result.pairwiseAccuracy).toBe(1);
  });
});
