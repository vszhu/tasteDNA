import type { Dish } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";

export function normalizeDishText(dish: Omit<Dish, "embedding">) {
  const activeTraits = TASTE_DIMENSIONS.filter((key) => dish.features[key] >= 0.55);
  return [
    dish.name,
    dish.description,
    `cuisine ${dish.cuisine}`,
    `ingredients ${dish.ingredients.join(", ")}`,
    `flavors and textures ${activeTraits.join(", ")}`,
    `proteins ${dish.features.proteinTypes.join(", ")}`,
    `base ${dish.features.carbohydrateTypes.join(", ")}`,
    `methods ${dish.features.cookingMethods.join(", ")}`,
  ]
    .filter(Boolean)
    .join(". ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
