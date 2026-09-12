import { describe, expect, it } from "vitest";
import importedMenus from "../../../scripts/data/cmu-dining-menus.json";
import estimateData from "./cmu-ingredient-estimates-data.json";
import {
  CMU_INGREDIENT_ESTIMATE_SOURCE,
  estimateCmuDishIngredients,
  getCmuIngredientEstimateCoverage,
} from "./cmu-ingredient-estimates";

describe("CMU typical ingredient estimates", () => {
  it("explicitly accounts for all 614 imported items across 37 venues, including unknown recipes", () => {
    const coverage = getCmuIngredientEstimateCoverage();
    expect(coverage).toMatchObject({
      venueCount: 37,
      itemCount: 614,
      estimatedItemCount: 467,
      unavailableItemCount: 147,
    });
    expect(CMU_INGREDIENT_ESTIMATE_SOURCE.kind).toBe("estimated");
    const records = estimateData as Record<string, Record<string, string[] | null>>;
    expect(Object.keys(records).sort()).toEqual(importedMenus.restaurants.map((venue) => String(venue.id)).sort());
    for (const venue of importedMenus.restaurants) {
      expect(Object.keys(records[String(venue.id)]).sort()).toEqual([...venue.items].sort());
      const entry = coverage.venues.find((candidate) => candidate.datasetId === venue.id)!;
      expect(entry.itemCount).toBe(venue.items.length);
      for (const dish of venue.items) {
        const ingredients = estimateCmuDishIngredients(venue.id, dish);
        if (ingredients === null) {
          expect(entry.unavailableDishNames).toContain(dish);
        } else {
          expect(ingredients.length).toBeGreaterThan(0);
          expect(ingredients.every((ingredient) => ingredient.trim().length > 0)).toBe(true);
          expect(new Set(ingredients).size).toBe(ingredients.length);
          expect(entry.unavailableDishNames).not.toContain(dish);
        }
      }
    }
  });

  it("keeps build-your-own, rotating meals, unspecified sushi and opaque aliases unavailable", () => {
    expect(estimateCmuDishIngredients(179, "Build Your Own Bowl")).toBeNull();
    expect(estimateCmuDishIngredients(179, "Seed Funding")).toBeNull();
    expect(estimateCmuDishIngredients(201, "Rotating Hot-Bar Entrée")).toBeNull();
    expect(estimateCmuDishIngredients(108, "Vegan Entrée")).toBeNull();
    expect(estimateCmuDishIngredients(103, "Sushi")).toBeNull();
    expect(estimateCmuDishIngredients(109, "Shawarma")).toBeNull();
  });

  it("uses exact venue and item identity without guessing new or renamed dishes", () => {
    expect(estimateCmuDishIngredients(114, "Butter Chicken")).toEqual(expect.arrayContaining(["chicken", "butter", "cream", "yogurt"]));
    expect(estimateCmuDishIngredients(113, "Butter Chicken")).toBeNull();
    expect(estimateCmuDishIngredients(114, "Butter Chicken Extra")).toBeNull();
    expect(estimateCmuDishIngredients(114, "butter chicken")).toBeNull();
    expect(estimateCmuDishIngredients(-1, "Coffee")).toBeNull();
    expect(estimateCmuDishIngredients(113.5, "Coffee")).toBeNull();
    expect(estimateCmuDishIngredients(113, "constructor")).toBeNull();
    expect(estimateCmuDishIngredients(113, "__proto__")).toBeNull();
  });

  it("preserves meaningful dish distinctions instead of giving everything the same base", () => {
    expect(estimateCmuDishIngredients(114, "Samosa")).toEqual(expect.arrayContaining(["potatoes", "peas", "wheat flour"]));
    expect(estimateCmuDishIngredients(114, "Saag Paneer")).toEqual(expect.arrayContaining(["spinach", "paneer", "cream"]));
    expect(estimateCmuDishIngredients(138, "Classic Spam Musubi")).toEqual(expect.arrayContaining(["rice", "Spam pork", "nori"]));
    expect(estimateCmuDishIngredients(138, "Teriyaki Tofu Musubi")).toEqual(expect.arrayContaining(["tofu", "nori", "soy sauce"]));
    expect(estimateCmuDishIngredients(113, "Plain Croissant")).toEqual(expect.arrayContaining(["wheat flour", "butter", "milk"]));
    expect(estimateCmuDishIngredients(113, "Chocolate Croissant")).toContain("chocolate");
    expect(estimateCmuDishIngredients(113, "Orange Juice")).not.toContain("milk");
  });

  it("does not add meat or dairy to explicitly vegan dish templates", () => {
    const vegan = estimateCmuDishIngredients(82, "Vegan Shawarma Pita")!;
    expect(vegan).toEqual(expect.arrayContaining(["plant-based shawarma", "tahini sauce"]));
    expect(vegan.join(" ")).not.toMatch(/milk|cheese|yogurt|chicken|lamb|beef|turkey/);
    const vegetarian = estimateCmuDishIngredients(194, "Vegetarian Bowl: Yuca con Mojo and Sweet Plantain con Arroz Amarillo y Frijoles")!;
    expect(vegetarian).toEqual(expect.arrayContaining(["yuca", "sweet plantain", "beans"]));
    expect(vegetarian.join(" ")).not.toMatch(/chicken|lamb|beef|pork|turkey/);
    expect(estimateCmuDishIngredients(113, "Caesar Salad Without Chicken")).not.toContain("chicken");
  });

  it("keeps coffee, dairy, tea and drink distinctions visible in estimates", () => {
    expect(estimateCmuDishIngredients(204, "Americano")).toEqual(["espresso coffee", "water"]);
    expect(estimateCmuDishIngredients(204, "Latte")).toEqual(["espresso coffee", "milk"]);
    expect(estimateCmuDishIngredients(204, "Matcha Latte")).toContain("matcha green tea");
    expect(estimateCmuDishIngredients(186, "Vietnamese Cold Brew")).toContain("sweetened condensed milk");
    expect(estimateCmuDishIngredients(206, "Water")).toEqual(["water"]);
  });

  it("keeps brand recipe differences attached to the correct venue", () => {
    expect(estimateCmuDishIngredients(191, "Avocado Toast")).toContain("feta cheese");
    expect(estimateCmuDishIngredients(210, "Avocado Toast")).not.toContain("feta cheese");
    expect(estimateCmuDishIngredients(191, "Overnight Oats")).toEqual(["oats", "oat milk"]);
    expect(estimateCmuDishIngredients(191, "P-B²")).toEqual(expect.arrayContaining(["banana", "chocolate protein", "peanut butter"]));
    expect(estimateCmuDishIngredients(191, "Dragon Bowl")).toEqual(expect.arrayContaining(["pitaya", "pineapple", "orange juice", "chia seeds"]));
  });

  it("returns a copy so one request cannot change later recipe estimates", () => {
    const ingredients = estimateCmuDishIngredients(113, "Coffee")!;
    ingredients.push("grapefruit");
    expect(estimateCmuDishIngredients(113, "Coffee")).toEqual(["coffee", "water"]);
  });
});
