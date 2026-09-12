import { describe, expect, it } from "vitest";
import { buildTasteProfile } from "@/lib/taste/profile";
import { createMedicationDemoMenu } from "./demo";
import { rankMedicationAwareMenu } from "./check";
import { buildMedicationMap, dishesForNode, dishNodeId, menuAlternatives, pathsForNode } from "./map";

const profile = buildTasteProfile("map-test", [], []);
function fixture(medications = ["simvastatin", "fexofenadine", "linezolid"]) {
  const menu = createMedicationDemoMenu();
  const recommendations = rankMedicationAwareMenu(menu, profile, medications);
  return { menu, recommendations, map: buildMedicationMap(recommendations, medications) };
}

describe("food and medicine map", () => {
  it("builds complete paths from medication rules to terms to the exact menu item", () => {
    const { map, recommendations } = fixture();
    const spritz = recommendations.find((item) => item.dish.name === "Pink Grapefruit Spritz")!;
    const paths = pathsForNode(map, dishNodeId(spritz.menuItemId));
    expect(paths).toHaveLength(2);
    expect(new Set(paths.map((path) => path.medicationId))).toEqual(new Set(["medication:simvastatin", "medication:fexofenadine"]));
    expect(paths.every((path) => path.ingredientId === "ingredient:grapefruit juice")).toBe(true);
    expect(new Set(map.nodes.map((node) => node.id)).size).toBe(map.nodes.length);
    expect(new Set(map.paths.map((path) => path.id)).size).toBe(map.paths.length);
    for (const path of map.paths) {
      expect(map.nodes.find((node) => node.id === path.medicationId)?.kind).toBe("medication");
      expect(map.nodes.find((node) => node.id === path.ingredientId)?.kind).toBe("ingredient");
      expect(map.nodes.find((node) => node.id === path.dishId)?.kind).toBe("dish");
      expect(path.finding.source.url).toMatch(/^https:\/\/(dailymed|medlineplus)/);
    }
  });

  it("deduplicates medicine aliases without connecting medicines to each other", () => {
    const { map } = fixture(["simvastatin", "Zocor", " SIMVASTATIN "]);
    expect(map.nodes.filter((node) => node.kind === "medication")).toHaveLength(1);
    expect(map.paths).toHaveLength(2);
  });

  it("does not expand a selection through unrelated paths sharing a food term", () => {
    const { map, recommendations } = fixture(["simvastatin", "tacrolimus-capsules"]);
    const paths = pathsForNode(map, "medication:simvastatin");
    expect(paths).toHaveLength(2);
    expect(paths.every((path) => path.medicationId === "medication:simvastatin")).toBe(true);
    expect(dishesForNode(map, recommendations, "medication:simvastatin").map((item) => item.dish.name).sort()).toEqual(["Citrus Salmon Crudo", "Pink Grapefruit Spritz"]);
    expect(pathsForNode(map, "ingredient:grapefruit").some((path) => path.medicationId === "medication:tacrolimus-capsules")).toBe(true);
  });

  it("uses rule ownership rather than inventing edges for the selected medicine", () => {
    const { recommendations } = fixture(["simvastatin"]);
    expect(buildMedicationMap(recommendations, ["fexofenadine"]).paths).toEqual([]);
  });

  it("preserves evidence per food term when a rule matches both menu text and inferred ingredients", () => {
    const menu = createMedicationDemoMenu();
    const dish = menu.items[0].dish;
    dish.name = "House pasta";
    dish.description = "Pasta with aged cheddar";
    dish.ingredients = ["aged cheddar", "soy sauce"];
    dish.features.majorIngredients = dish.ingredients;
    const recommendations = rankMedicationAwareMenu(menu, profile, ["linezolid"]);
    const map = buildMedicationMap(recommendations, ["linezolid"]);
    const paths = pathsForNode(map, dishNodeId(menu.items[0].id));
    expect(paths.find((path) => path.ingredientId === "ingredient:aged cheddar")?.evidence).toBe("menu-text");
    expect(paths.find((path) => path.ingredientId === "ingredient:soy sauce")?.evidence).toBe("inferred-ingredient");
    expect(paths.find((path) => path.ingredientId === "ingredient:soy sauce")?.severity).toBe("review");
  });

  it("keeps unrecognized medicines visible without fabricating connections or alternatives", () => {
    const { map, recommendations } = fixture(["unknown medicine"]);
    expect(map.nodes.find((node) => node.kind === "medication")?.detail).toBe("Outside this reference");
    expect(map.paths).toEqual([]);
    expect(recommendations.every((item) => item.medicationCheck.status === "review")).toBe(true);
    expect(menuAlternatives(recommendations)).toEqual([]);
  });

  it("does not draw checks or offer a shortlist with no medicines", () => {
    const { map, recommendations } = fixture([]);
    expect(map.nodes.every((node) => node.kind === "dish")).toBe(true);
    expect(map.paths).toEqual([]);
    expect(menuAlternatives(recommendations)).toEqual([]);
  });

  it("does not draw a clinical graph for a sample substituted for an unread photo", () => {
    const menu = createMedicationDemoMenu();
    menu.menu.sourceType = "image";
    const recommendations = rankMedicationAwareMenu(menu, profile, ["simvastatin"]);
    const map = buildMedicationMap(recommendations, ["simvastatin"]);
    expect(map.paths).toEqual([]);
    expect(map.nodes.every((node) => node.status === "not-checked")).toBe(true);
    expect(menuAlternatives(recommendations)).toEqual([]);
  });

  it("keeps taste-ranked alternatives inside the no-listed-match group and excludes the current dish", () => {
    const { recommendations } = fixture();
    const current = recommendations[0];
    const warning = recommendations.find((item) => item.medicationCheck.status === "avoid")!;
    warning.score = 100;
    const other = recommendations.find((item) => item.menuItemId !== current.menuItemId && item.medicationCheck.status === "no-listed-match")!;
    other.score = 99;
    const alternatives = menuAlternatives(recommendations, current.menuItemId);
    expect(alternatives[0].menuItemId).toBe(other.menuItemId);
    expect(alternatives).toHaveLength(3);
    expect(alternatives.every((item) => item.medicationCheck.status === "no-listed-match" && item.menuItemId !== current.menuItemId)).toBe(true);
  });

  it("does not mutate ranked dishes or graph paths when exploring, filtering, or finding alternatives", () => {
    const { recommendations, map } = fixture();
    const before = JSON.stringify({ recommendations, map });
    pathsForNode(map, "medication:simvastatin");
    dishesForNode(map, recommendations, "ingredient:grapefruit juice");
    menuAlternatives(recommendations);
    expect(JSON.stringify({ recommendations, map })).toBe(before);
  });
});
