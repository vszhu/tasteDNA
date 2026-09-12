import type { MenuItem, TasteProfile } from "@/types";
import type { DishUtility, DishUtilityFactor, MealPreferenceState, MealPreferenceTag } from "@/types/group";
import { clamp } from "@/lib/utils";
import { scoreCandidate } from "./scoring";

export const MEAL_UTILITY_WEIGHTS = {
  persistent: 0.75,
  mealContext: 0.25,
  cheapPriceReference: 12,
} as const;

export interface MealDishUtilityInput {
  memberId: string;
  venueId: string;
  menuItem: MenuItem;
  profile: TasteProfile;
  mealPreferenceState: MealPreferenceState;
}

interface ContextSignal {
  label: string;
  score: number;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tagAlignment(tag: MealPreferenceTag, item: MenuItem): number | null {
  const { features } = item.dish;
  switch (tag) {
    case "spicy":
      return features.spicy * 100;
    case "light":
      return average([features.fresh, 1 - features.rich, 1 - features.creamy]) * 100;
    case "comforting":
      return average([features.umami, features.rich, features.creamy]) * 100;
    case "filling":
      return average([features.umami, features.rich, features.chewy]) * 100;
    case "cheap":
      return item.price == null
        ? null
        : clamp(100 - (item.price / (MEAL_UTILITY_WEIGHTS.cheapPriceReference * 2)) * 100, 0, 100);
    case "quick":
      return features.cookingMethods.some((method) => /quick|fast/i.test(method)) ? 100 : null;
  }
}

function contextSignals(state: MealPreferenceState, item: MenuItem): ContextSignal[] {
  const desired = state.desiredTags.flatMap((tag) => {
    const score = tagAlignment(tag, item);
    return score == null ? [] : [{ label: `Wants ${tag}`, score }];
  });
  const avoided = state.avoidedTags.flatMap((tag) => {
    const score = tagAlignment(tag, item);
    return score == null ? [] : [{ label: `Avoids ${tag}`, score: 100 - score }];
  });
  return [...desired, ...avoided];
}

function normalizedValues(values: string[]) {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function exclusionReason(state: MealPreferenceState, item: MenuItem) {
  const ingredients = normalizedValues([...item.dish.ingredients, ...item.dish.features.majorIngredients]);
  const proteins = normalizedValues(item.dish.features.proteinTypes);
  const excludedIngredient = state.excludedIngredients.find((value) => ingredients.has(value.trim().toLowerCase()));
  if (excludedIngredient) return `Contains excluded ingredient: ${excludedIngredient}`;

  const excludedProtein = state.excludedProteinTypes.find((value) => proteins.has(value.trim().toLowerCase()));
  if (excludedProtein) return `Contains excluded protein: ${excludedProtein}`;

  if (state.maxPrice != null && item.price != null && item.price > state.maxPrice) {
    return `Exceeds meal price ceiling of ${state.maxPrice}`;
  }
  return undefined;
}

/**
 * Scores one menu item for one meal without mutating the member's long-term
 * TasteDNA profile. Missing dish data yields no context adjustment rather than
 * a guessed signal.
 */
export function scoreDishForMeal(input: MealDishUtilityInput): DishUtility {
  const { memberId, venueId, menuItem, profile, mealPreferenceState } = input;
  const baseScore = scoreCandidate(menuItem.dish, profile).score;
  const reason = exclusionReason(mealPreferenceState, menuItem);
  if (reason) {
    return {
      memberId,
      venueId,
      dish: menuItem.dish,
      menuItemId: menuItem.id,
      baseScore,
      contextAdjustment: -baseScore,
      utility: 0,
      excluded: true,
      exclusionReason: reason,
      factors: [{ label: reason, contribution: -baseScore, kind: "constraint" }],
    };
  }

  const signals = contextSignals(mealPreferenceState, menuItem);
  if (signals.length === 0) {
    return {
      memberId,
      venueId,
      dish: menuItem.dish,
      menuItemId: menuItem.id,
      baseScore,
      contextAdjustment: 0,
      utility: baseScore,
      excluded: false,
      factors: [{ label: "Persistent TasteDNA", contribution: baseScore, kind: "persistent" }],
    };
  }

  const contextScore = average(signals.map((signal) => signal.score));
  const utility = Math.round(clamp(
    baseScore * MEAL_UTILITY_WEIGHTS.persistent + contextScore * MEAL_UTILITY_WEIGHTS.mealContext,
    0,
    100,
  ));
  const factors: DishUtilityFactor[] = [
    { label: "Persistent TasteDNA", contribution: baseScore * MEAL_UTILITY_WEIGHTS.persistent, kind: "persistent" },
    ...signals.map((signal) => ({
      label: signal.label,
      contribution: (signal.score * MEAL_UTILITY_WEIGHTS.mealContext) / signals.length,
      kind: "meal-context" as const,
    })),
  ];

  return {
    memberId,
    venueId,
    dish: menuItem.dish,
    menuItemId: menuItem.id,
    baseScore,
    contextAdjustment: utility - baseScore,
    utility,
    excluded: false,
    factors,
  };
}
