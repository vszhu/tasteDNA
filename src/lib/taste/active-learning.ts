import type { Dish, Rating } from "@/types";
import { cosineSimilarity } from "./math";

/** Farthest-first selection gives onboarding broad coverage without opaque ML. */
export function selectOnboardingDishes(dishes: Dish[], ratings: Rating[], count: number) {
  const ratedIds = new Set(ratings.map((rating) => rating.dishId));
  const ratedDishes = dishes.filter((dish) => ratedIds.has(dish.id));
  const candidates = dishes.filter((dish) => !ratedIds.has(dish.id));
  const selected: Dish[] = [];

  while (selected.length < count && candidates.length > 0) {
    const anchors = [...ratedDishes, ...selected];
    let bestIndex = 0;
    let bestNovelty = -Infinity;
    candidates.forEach((candidate, index) => {
      const novelty = anchors.length === 0
        ? (candidate.features.spicy + candidate.features.sour + candidate.features.umami) / 3
        : Math.min(...anchors.map((anchor) => 1 - cosineSimilarity(candidate.embedding, anchor.embedding)));
      if (novelty > bestNovelty) {
        bestNovelty = novelty;
        bestIndex = index;
      }
    });
    selected.push(candidates.splice(bestIndex, 1)[0]);
  }
  return selected;
}
