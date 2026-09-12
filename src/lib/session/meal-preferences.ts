import type { MealPreferenceState, MealPreferenceTag } from "@/types/group";

/**
 * Pure state transitions for one meal's temporary check-in. Nothing here
 * touches `Rating`, `TasteProfile`, or `rateDish` — this module doesn't even
 * import from `taste-provider.tsx` or `@/lib/taste/*`, by design, so a
 * meal check-in can never leak into someone's standing TasteDNA.
 */

export const EMPTY_MEAL_PREFERENCE_STATE: MealPreferenceState = {
  desiredTags: [],
  avoidedTags: [],
  excludedIngredients: [],
  excludedProteinTypes: [],
};

export type TagPreference = "neutral" | "desired" | "avoided";

export function tagPreference(state: MealPreferenceState, tag: MealPreferenceTag): TagPreference {
  if (state.desiredTags.includes(tag)) return "desired";
  if (state.avoidedTags.includes(tag)) return "avoided";
  return "neutral";
}

/** Sets one mood tag to an exact preference, regardless of its current state. */
export function setTagPreference(state: MealPreferenceState, tag: MealPreferenceTag, preference: TagPreference): MealPreferenceState {
  const withoutTag = { desiredTags: state.desiredTags.filter((entry) => entry !== tag), avoidedTags: state.avoidedTags.filter((entry) => entry !== tag) };
  if (preference === "desired") return { ...state, ...withoutTag, desiredTags: [...withoutTag.desiredTags, tag] };
  if (preference === "avoided") return { ...state, ...withoutTag, avoidedTags: [...withoutTag.avoidedTags, tag] };
  return { ...state, ...withoutTag };
}

/** Cycles one mood tag: neutral -> desired -> avoided -> neutral. */
export function cycleTagPreference(state: MealPreferenceState, tag: MealPreferenceTag): MealPreferenceState {
  const current = tagPreference(state, tag);
  const next: TagPreference = current === "neutral" ? "desired" : current === "desired" ? "avoided" : "neutral";
  return setTagPreference(state, tag, next);
}

function toggleInList(list: string[], value: string): string[] {
  const normalized = value.trim();
  if (!normalized) return list;
  const exists = list.some((entry) => entry.toLowerCase() === normalized.toLowerCase());
  return exists ? list.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase()) : [...list, normalized];
}

export function toggleExcludedIngredient(state: MealPreferenceState, ingredient: string): MealPreferenceState {
  return { ...state, excludedIngredients: toggleInList(state.excludedIngredients, ingredient) };
}

export function toggleExcludedProteinType(state: MealPreferenceState, proteinType: string): MealPreferenceState {
  return { ...state, excludedProteinTypes: toggleInList(state.excludedProteinTypes, proteinType) };
}

export function setMaxPrice(state: MealPreferenceState, maxPrice: number | undefined): MealPreferenceState {
  const next = { ...state };
  if (maxPrice == null) delete next.maxPrice;
  else next.maxPrice = maxPrice;
  return next;
}
