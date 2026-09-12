import type { Dish, MenuItem, Recommendation, TasteProfile } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";
import { clamp, titleCase } from "@/lib/utils";
import { cosineSimilarity } from "@/lib/taste/math";
import { RECOMMENDATION_WEIGHTS } from "@/lib/taste/constants";

export function structuredCompatibility(dish: Dish, profile: TasteProfile) {
  let contribution = 0;
  let preferenceMass = 0;
  for (const dimension of TASTE_DIMENSIONS) {
    const preference = profile.attributePreferences[dimension];
    contribution += preference * dish.features[dimension];
    preferenceMass += Math.abs(preference);
  }
  return preferenceMass === 0 ? 0 : clamp(contribution / preferenceMass, -1, 1);
}

function topFactors(dish: Dish, profile: TasteProfile) {
  const factors = TASTE_DIMENSIONS.map((dimension) => ({
    dimension,
    contribution: profile.attributePreferences[dimension] * dish.features[dimension],
  })).filter(({ contribution }) => Math.abs(contribution) > 0.015);

  const positives = factors
    .filter(({ contribution }) => contribution > 0)
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 3)
    .map(({ dimension }) => titleCase(dimension));
  const negatives = factors
    .filter(({ contribution }) => contribution < 0)
    .sort((left, right) => left.contribution - right.contribution)
    .slice(0, 2)
    .map(({ dimension }) => titleCase(dimension));

  const favoriteCuisine = dish.features.cuisines.find(
    (cuisine) => (profile.cuisinePreferences[cuisine.toLowerCase()] ?? 0) > 0.2,
  );
  if (favoriteCuisine && positives.length < 3) positives.push(`${titleCase(favoriteCuisine)} cuisine`);

  const favoriteMethod = dish.features.cookingMethods.find(
    (method) => (profile.cookingMethodPreferences[method.toLowerCase()] ?? 0) > 0.2,
  );
  if (favoriteMethod && positives.length < 3) positives.push(titleCase(favoriteMethod));
  return { positives, negatives };
}

function explain(dish: Dish, score: number, positives: string[], negatives: string[]) {
  const lead = score >= 78 ? "This is a strong fit" : score >= 58 ? "This looks promising" : "This may stretch your palate";
  const match = positives.length ? ` because it leans ${positives.join(", ").toLowerCase()}` : " based on your current ratings";
  const caution = negatives.length ? `. The ${negatives.join(" and ").toLowerCase()} notes may be less aligned` : "";
  return `${lead}${match}${caution}.`;
}

export function scoreCandidate(dish: Dish, profile: TasteProfile) {
  if (profile.ratingCount === 0) {
    return { score: 50, semanticScore: 0, structuredScore: 0, positiveFactors: [], negativeFactors: [], explanation: "Rate a few foods to personalize this match." };
  }
  const semanticScore = cosineSimilarity(profile.semanticVector, dish.embedding);
  const structuredScore = structuredCompatibility(dish, profile);
  const combined = semanticScore * RECOMMENDATION_WEIGHTS.semantic +
    structuredScore * RECOMMENDATION_WEIGHTS.structured;
  const score = Math.round(clamp((combined + 1) * 50, 0, 100));
  const { positives, negatives } = topFactors(dish, profile);
  return {
    score,
    semanticScore,
    structuredScore,
    positiveFactors: positives,
    negativeFactors: negatives,
    explanation: explain(dish, score, positives, negatives),
  };
}

export function rankMenuItems(items: MenuItem[], profile: TasteProfile): Recommendation[] {
  return items
    .map((item) => ({
      id: `rec-${item.id}`,
      menuItemId: item.id,
      dish: item.dish,
      price: item.price,
      menuOrder: item.menuOrder,
      ...scoreCandidate(item.dish, profile),
      rank: 0,
    }))
    .sort((left, right) => right.score - left.score || left.menuOrder - right.menuOrder)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}
