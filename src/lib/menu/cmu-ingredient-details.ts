import type { MenuItem } from "@/types";

export const CMU_ABP_MENU_URL = "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf";
export const CMU_INGREDIENT_SOURCE_CHECKED_AT = "2026-09-12";

export interface CmuMenuSource {
  sourceProvider?: string | null;
  sourceUri?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
}

/** Restrict repairs to the original name-only import, never a later user menu. */
export function isOriginalCmuDatasetSource(source: CmuMenuSource): boolean {
  return source.sourceProvider === "cmu-dining-dataset-v2" &&
    source.sourceMetadata?.datasetGeneratedDate === "2026-09-11" &&
    source.sourceMetadata?.dishDetailsInferredFromNames === true;
}

/**
 * Component facts transcribed from CMU's linked ABP menu on 2026-09-12.
 * Exact imported names resolve menu headings (e.g. Mediterranean salad vs wrap).
 * These are published components, not complete recipes or allergen declarations.
 * Never add likely subingredients or convert a preparation into a clinical claim.
 */
const ABP_COMPONENTS: Readonly<Record<string, readonly string[]>> = {
  "The Good Egg": ["rustic baguette", "eggs", "NY cheddar", "tomatoes", "avocado", "spinach", "lemon aioli"],
  "Power Protein Wrap": ["eggs", "turkey sausage", "NY cheddar", "avocado", "spinach", "tomatoes", "herb aioli", "flour tortilla"],
  "Egg Whites & Cheddar": ["egg whites", "cheddar", "skinny wheat bagel"],
  "Egg Whites, Cheddar & Avocado": ["egg whites", "cheddar", "avocado", "skinny wheat bagel", "butter"],
  "Chicken Cobb Avocado Salad": ["chicken", "romaine", "field greens", "avocado", "hardwood smoked bacon", "gorgonzola", "hard boiled egg", "grape tomatoes", "cucumbers", "green goddess dressing"],
  "Southwest Chicken Salad": ["marinated chicken", "romaine", "black beans", "roasted corn", "avocado", "cucumbers", "grape tomatoes", "ranch dressing"],
  "Chicken Caesar Asiago Salad": ["chicken", "romaine", "housemade croutons", "asiago cheese", "caesar dressing"],
  "Mediterranean Salad": ["romaine", "field greens", "hummus", "avocado", "kalamata olives", "feta", "grape tomatoes", "red bell peppers", "cucumbers", "balsamic vinaigrette"],
  "Extra Bacon BLT": ["toasted rustic baguette", "hardwood smoked bacon", "tomatoes", "field greens", "mayo"],
  "Caprese Sandwich": ["ciabatta", "fresh mozzarella", "tomatoes", "arugula", "pesto"],
  "ABP's Original Chicken Salad Sandwich": ["toasted croissant", "chicken", "cranberries", "toasted almonds", "mayo", "tomatoes", "field greens"],
  "Classic Tuna Salad Sandwich": ["toasted croissant", "tuna", "herb blend", "mayo", "tomatoes", "field greens", "red onions"],
};

/** Read-time repair preserves persisted identities, prices, ordering, and taste data. */
export function applyConfirmedCmuIngredientDetails(item: MenuItem, source: CmuMenuSource): MenuItem {
  if (!isOriginalCmuDatasetSource(source) || source.sourceMetadata?.datasetId !== 113 ||
    source.sourceUri !== CMU_ABP_MENU_URL || item.dish.ingredients.length > 0) return item;
  const components = ABP_COMPONENTS[item.dish.name];
  if (!components) return item;
  const ingredients = [...components];
  return {
    ...item,
    dish: {
      ...item.dish,
      description: `Published menu components: ${ingredients.join(", ")}. Recipes, subingredients, and current availability need confirmation.`,
      ingredients,
      ingredientSource: {
        kind: "published-menu", label: "CMU published menu components",
        url: CMU_ABP_MENU_URL, checkedAt: CMU_INGREDIENT_SOURCE_CHECKED_AT,
      },
      features: {
        ...item.dish.features,
        majorIngredients: [...ingredients],
        unknownFields: item.dish.features.unknownFields?.filter((field) => !/ingredient|description/i.test(field)),
      },
    },
  };
}
