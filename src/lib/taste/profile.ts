import type { Dish, Rating, TasteDimension, TasteFeatureVector, TasteProfile } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";
import { normalizeVector, ratingToWeight } from "./math";

const TEXTURE_KEYS: TasteDimension[] = ["crispy", "creamy", "chewy", "fresh"];

/**
 * Separate affinity representations let later scorers reward similarity to foods a
 * person likes and penalize similarity to foods they reject.  They intentionally
 * stay separate from TasteProfile for now: that shared contract is consumed by the
 * UI and persistence layers and needs a coordinated change before being extended.
 */
export interface PreferenceRepresentations {
  positiveSemanticVector: number[];
  negativeSemanticVector: number[];
  positiveAttributePreferences: TasteFeatureVector;
  negativeAttributePreferences: TasteFeatureVector;
  positiveWeight: number;
  negativeWeight: number;
}

function emptyTasteVector(): TasteFeatureVector {
  return Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, 0])) as TasteFeatureVector;
}

export function generateTasteVector(ratings: Rating[], dishes: Dish[]) {
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const dimensions = dishes[0]?.embedding.length ?? 0;
  const accumulated = Array.from({ length: dimensions }, () => 0);

  for (const rating of ratings) {
    const dish = dishMap.get(rating.dishId);
    if (!dish || dish.embedding.length !== dimensions) continue;
    const weight = ratingToWeight(rating.value);
    dish.embedding.forEach((value, index) => {
      accumulated[index] += weight * value;
    });
  }

  return normalizeVector(accumulated);
}

export function generateAttributePreferences(ratings: Rating[], dishes: Dish[]) {
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const totals = emptyTasteVector();
  let absoluteWeight = 0;

  for (const rating of ratings) {
    const dish = dishMap.get(rating.dishId);
    if (!dish) continue;
    const weight = ratingToWeight(rating.value);
    if (weight === 0) continue;
    absoluteWeight += Math.abs(weight);
    for (const dimension of TASTE_DIMENSIONS) {
      totals[dimension] += weight * dish.features[dimension];
    }
  }

  if (absoluteWeight === 0) return totals;
  for (const dimension of TASTE_DIMENSIONS) totals[dimension] /= absoluteWeight;
  return totals;
}

export function generatePreferenceRepresentations(
  ratings: Rating[],
  dishes: Dish[],
): PreferenceRepresentations {
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const dimensions = dishes[0]?.embedding.length ?? 0;
  const positiveSemantic = Array.from({ length: dimensions }, () => 0);
  const negativeSemantic = Array.from({ length: dimensions }, () => 0);
  const positiveAttributes = emptyTasteVector();
  const negativeAttributes = emptyTasteVector();
  let positiveWeight = 0;
  let negativeWeight = 0;

  for (const rating of ratings) {
    const dish = dishMap.get(rating.dishId);
    if (!dish || dish.embedding.length !== dimensions) continue;
    const signedWeight = ratingToWeight(rating.value);
    if (signedWeight === 0) continue;

    const isPositive = signedWeight > 0;
    const weight = Math.abs(signedWeight);
    const semantic = isPositive ? positiveSemantic : negativeSemantic;
    const attributes = isPositive ? positiveAttributes : negativeAttributes;
    if (isPositive) positiveWeight += weight;
    else negativeWeight += weight;

    dish.embedding.forEach((value, index) => {
      semantic[index] += weight * value;
    });
    for (const dimension of TASTE_DIMENSIONS) {
      attributes[dimension] += weight * dish.features[dimension];
    }
  }

  for (const dimension of TASTE_DIMENSIONS) {
    if (positiveWeight > 0) positiveAttributes[dimension] /= positiveWeight;
    if (negativeWeight > 0) negativeAttributes[dimension] /= negativeWeight;
  }

  return {
    positiveSemanticVector: normalizeVector(positiveSemantic),
    negativeSemanticVector: normalizeVector(negativeSemantic),
    positiveAttributePreferences: positiveAttributes,
    negativeAttributePreferences: negativeAttributes,
    positiveWeight,
    negativeWeight,
  };
}

function categoricalPreferences(
  ratings: Rating[],
  dishes: Dish[],
  select: (dish: Dish) => string[],
) {
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const scores: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const rating of ratings) {
    const dish = dishMap.get(rating.dishId);
    if (!dish) continue;
    const weight = ratingToWeight(rating.value);
    for (const value of select(dish)) {
      const key = value.toLowerCase();
      scores[key] = (scores[key] ?? 0) + weight;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  for (const key of Object.keys(scores)) scores[key] /= counts[key];
  return scores;
}

function positiveKeys(scores: Record<string, number>, limit: number) {
  return Object.entries(scores)
    .filter(([, score]) => score > 0.05)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function buildTasteProfile(userId: string, ratings: Rating[], dishes: Dish[]): TasteProfile {
  const attributePreferences = generateAttributePreferences(ratings, dishes);
  const cuisinePreferences = categoricalPreferences(ratings, dishes, (dish) => dish.features.cuisines);
  const cookingMethodPreferences = categoricalPreferences(
    ratings,
    dishes,
    (dish) => dish.features.cookingMethods,
  );
  const sortedDimensions = [...TASTE_DIMENSIONS].sort(
    (left, right) => attributePreferences[right] - attributePreferences[left],
  );
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const representativeDishIds = ratings
    .filter((rating) => rating.value >= 4 && dishMap.has(rating.dishId))
    .sort((left, right) => right.value - left.value)
    .slice(0, 4)
    .map((rating) => rating.dishId);

  return {
    id: `profile-${userId}`,
    userId,
    semanticVector: generateTasteVector(ratings, dishes),
    attributePreferences,
    cuisinePreferences,
    cookingMethodPreferences,
    favoriteCuisines: positiveKeys(cuisinePreferences, 4),
    strongestPositiveFlavors: sortedDimensions.filter((key) => attributePreferences[key] > 0.04).slice(0, 4),
    strongestNegativeFlavors: sortedDimensions
      .filter((key) => attributePreferences[key] < -0.04)
      .reverse()
      .slice(0, 3),
    favoriteTextures: TEXTURE_KEYS.sort(
      (left, right) => attributePreferences[right] - attributePreferences[left],
    ).filter((key) => attributePreferences[key] > 0.03).slice(0, 3),
    preferredCookingStyles: positiveKeys(cookingMethodPreferences, 4),
    representativeDishIds,
    ratingCount: ratings.length,
    confidence: ratings.length >= 18 ? "well defined" : ratings.length >= 10 ? "taking shape" : "early read",
    updatedAt: new Date().toISOString(),
  };
}
