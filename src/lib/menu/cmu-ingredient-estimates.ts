import estimateData from "./cmu-ingredient-estimates-data.json";

/**
 * Typical recipe components for the exact items in the September 11 CMU import.
 * These are NOT restaurant-verified ingredient lists or medical clearance.
 * Consumers must keep estimated provenance and ingredient uncertainty visible;
 * never remove the ingredients-estimated marker to make a dish pass screening.
 *
 * Most records are manually curated typical-recipe estimates from dish names.
 * Shake Smart's named recipe components were also checked against its brand menu
 * (https://shakesmart.com/menu/, September 12, 2026); complete formulations,
 * substitutions, toppings, and campus availability remain unverified.
 *
 * A null record explicitly means the imported name is a variable menu category
 * or does not identify a recipe well enough to estimate. It must remain unknown.
 * Published menu evidence belongs in the separate source supplement and wins
 * over these estimates. This file never adds a menu item or changes its name.
 */
const estimates: Readonly<Record<string, Readonly<Record<string, readonly string[] | null>>>> = estimateData;

export const CMU_INGREDIENT_ESTIMATE_VERSION = "2026-09-12.1";

export const CMU_INGREDIENT_ESTIMATE_SOURCE = {
  kind: "estimated",
  label: "Typical recipe estimate; confirm the restaurant's actual ingredients",
} as const;

/** Exact imported venue ID + item identity; never apply a fuzzy recipe match. */
export function estimateCmuDishIngredients(datasetId: number, dishName: string): string[] | null {
  if (!Number.isInteger(datasetId)) return null;
  const venue = estimates[String(datasetId)];
  if (!venue || !Object.prototype.hasOwnProperty.call(venue, dishName)) return null;
  const ingredients = venue[dishName];
  // Do not allow a caller to mutate recipe data used by subsequent requests.
  return ingredients ? [...ingredients] : null;
}

/** Audit every imported item, including explicit gaps; counts are not coverage guarantees. */
export function getCmuIngredientEstimateCoverage() {
  const venues = Object.entries(estimates).map(([datasetId, dishes]) => {
    const unavailableDishNames = Object.entries(dishes)
      .filter(([, ingredients]) => ingredients === null)
      .map(([dishName]) => dishName);
    const itemCount = Object.keys(dishes).length;
    return {
      datasetId: Number(datasetId),
      itemCount,
      estimatedItemCount: itemCount - unavailableDishNames.length,
      unavailableItemCount: unavailableDishNames.length,
      unavailableDishNames,
    };
  });
  return {
    version: CMU_INGREDIENT_ESTIMATE_VERSION,
    venueCount: venues.length,
    itemCount: venues.reduce((sum, venue) => sum + venue.itemCount, 0),
    estimatedItemCount: venues.reduce((sum, venue) => sum + venue.estimatedItemCount, 0),
    unavailableItemCount: venues.reduce((sum, venue) => sum + venue.unavailableItemCount, 0),
    venues,
  };
}
