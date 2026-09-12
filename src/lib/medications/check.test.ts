import { describe, expect, it } from "vitest";
import type { Dish } from "@/types";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { buildTasteProfile } from "@/lib/taste/profile";
import { rankMenuItems } from "@/lib/recommendation/scoring";
import { parsePastedMenu, processExtractedMenu } from "@/lib/menu/process";
import { MEDICATION_CATALOG, findMedication } from "./catalog";
import { canShortlist, checkDishMedications, rankMedicationAwareMenu, sortMedicationRecommendations } from "./check";
import { createMedicationDemoMenu } from "./demo";

function dish(name: string, description: string, ingredients: string[] = ["water"]): Dish {
  return {
    ...SEED_DISHES[0], name, description, ingredients,
    features: { ...SEED_DISHES[0].features, majorIngredients: ingredients, unknownFields: [] },
  };
}

const neutral = buildTasteProfile("test", [], []);

describe("medication identity and evidence", () => {
  it("matches exact brand aliases without expanding to other statins or formulations", () => {
    expect(findMedication("  ZOCOR  ")?.id).toBe("simvastatin");
    expect(findMedication("Allegra")?.id).toBe("fexofenadine");
    expect(findMedication("atorvastatin")).toBeUndefined();
    expect(findMedication("Allegra-D")).toBeUndefined();
    expect(findMedication("tacrolimus ointment")).toBeUndefined();
    expect(findMedication("tacrolimus")).toBeUndefined();
    expect(findMedication("tacrolimus oral capsules")?.id).toBe("tacrolimus-capsules");
  });

  it("deduplicates generic and brand entries", () => {
    const check = checkDishMedications(dish("Spritz", "Grapefruit juice and water"), ["simvastatin", "Zocor"]);
    expect(check.findings).toHaveLength(1);
    expect(check.status).toBe("avoid");
  });

  it("backs every rule with a named source and section", () => {
    for (const medication of MEDICATION_CATALOG) for (const rule of medication.rules) {
      expect(new URL(rule.source.url).hostname).toMatch(/^(dailymed\.nlm\.nih\.gov|medlineplus\.gov)$/);
      expect(rule.source.section.length).toBeGreaterThan(4);
      expect(rule.terms.length).toBeGreaterThan(0);
    }
  });

  it("distinguishes a juice avoidance label from whole-fruit review guidance", () => {
    const juice = checkDishMedications(dish("Spritz", "Pink grapefruit juice"), ["simvastatin"]);
    expect(juice.status).toBe("avoid");
    expect(juice.findings).toHaveLength(1);
    expect(juice.findings[0].source.title).toContain("DailyMed");
    const fruit = checkDishMedications(dish("Crudo", "Salmon, grapefruit and fennel"), ["simvastatin"]);
    expect(fruit.status).toBe("review");
    expect(fruit.findings[0].source.title).toContain("MedlinePlus");
  });

  it("checks all selected medicines and retains unsupported entries", () => {
    const check = checkDishMedications(dish("Spritz", "Grapefruit juice"), ["simvastatin", "fexofenadine", "unlisted medicine"]);
    expect(check.findings.map((finding) => finding.medicationName)).toEqual(["Simvastatin", "Fexofenadine"]);
    expect(check.unsupportedMedications).toEqual(["unlisted medicine"]);
    expect(check.status).toBe("avoid");
  });

  it.each(["Grape juice", "Grapes with fruit", "Orange slices", "Papaya", "Grapefruitish flavor"])("does not confuse unrelated words with grapefruit: %s", (description) => {
    expect(checkDishMedications(dish("Fruit", description), ["simvastatin"]).findings).toHaveLength(0);
  });

  it.each(["No grapefruit juice", "Without grapefruit juice", "Grapefruit-free drink", "Optional grapefruit", "Grapefruit on request"])("requires confirmation of qualified mentions: %s", (description) => {
    const check = checkDishMedications(dish("Drink", description, ["grapefruit juice"]), ["tacrolimus-capsules"]);
    expect(check.status).toBe("review");
    expect(check.findings[0].evidence).toBe("qualified-mention");
    expect(canShortlist(check)).toBe(false);
  });

  it("does not treat inferred ingredients as confirmed menu text", () => {
    const check = checkDishMedications(dish("House dressing", "Citrus and herbs", ["grapefruit juice"]), ["simvastatin"]);
    expect(check.status).toBe("review");
    expect(check.findings[0].evidence).toBe("inferred-ingredient");
  });

  it("handles normalized punctuation and casing in explicit ingredients", () => {
    const check = checkDishMedications(dish("Noodles", "SOY-SAUCE glaze"), ["linezolid"]);
    expect(check.findings[0].matchedTerms).toEqual(["soy sauce"]);
    expect(check.status).toBe("review");
  });

  it("does not turn linezolid portion guidance into a categorical food ban", () => {
    const check = checkDishMedications(dish("Pasta", "Aged cheddar, soy sauce and red wine"), ["linezolid"]);
    expect(check.status).toBe("review");
    expect(check.findings[0].explanation).toContain("large quantities");
    expect(check.findings[0].matchedTerms).toHaveLength(3);
  });

  it("keeps fexofenadine guidance specific to administration with juice", () => {
    const check = checkDishMedications(dish("Cooler", "Orange juice and apple juice"), ["fexofenadine"]);
    expect(check.status).toBe("review");
    expect(check.findings[0].explanation).toContain("not a blanket restriction");
    expect(checkDishMedications(dish("Snack", "Orange slices and apple wedges"), ["fexofenadine"]).findings).toHaveLength(0);
  });

  it("never infers interactions from umami, bitterness, cuisine, or cooking traits", () => {
    const candidate = dish("Chef special", "Rice and herbs", ["rice", "herbs"]);
    candidate.features.umami = 1;
    candidate.features.bitter = 1;
    candidate.features.cuisines = ["Japanese"];
    candidate.features.cookingMethods = ["fermented"];
    expect(checkDishMedications(candidate, ["linezolid", "simvastatin"]).findings).toEqual([]);
  });
});

describe("uncertainty and ranking", () => {
  it("does not shortlist dishes when medication coverage is missing", () => {
    const check = checkDishMedications(dish("Salad", "Fresh herbs"), ["warfarin"]);
    expect(check.status).toBe("review");
    expect(check.unsupportedMedications).toEqual(["warfarin"]);
    expect(canShortlist(check)).toBe(false);
  });

  it("keeps missing and uncertain ingredients in review", () => {
    expect(checkDishMedications(dish("Chef special", "", []), ["simvastatin"]).status).toBe("review");
    const candidate = dish("House bowl", "Rice");
    candidate.features.unknownFields = ["ingredients"];
    expect(checkDishMedications(candidate, ["simvastatin"]).status).toBe("review");
  });

  it("describes no match as limited evidence, never as safety", () => {
    const check = checkDishMedications(dish("Salad", "Lettuce and olive oil", ["lettuce", "olive oil"]), ["simvastatin"]);
    expect(check.status).toBe("no-listed-match");
    expect(check.reason).toContain("remain unverified");
  });

  it("preserves the original ordering, scores, and explanations with no medication list", () => {
    const menu = createMedicationDemoMenu();
    const original = rankMenuItems(menu.items, neutral);
    const added = rankMedicationAwareMenu(menu, neutral, []);
    expect(added.map(({ medicationCheck, tasteRank, ...recommendation }) => {
      expect(medicationCheck.status).toBe("not-checked");
      expect(tasteRank).toBe(recommendation.rank);
      return recommendation;
    })).toEqual(original);
  });

  it("keeps warnings below other options even when feedback makes the flagged dish a favorite", () => {
    const menu = createMedicationDemoMenu();
    const favorite = menu.items.find((item) => item.dish.name === "Pink Grapefruit Spritz")!.dish;
    const profile = buildTasteProfile("test", [{ id: "r", userId: "test", dishId: favorite.id, value: 5, source: "feedback", createdAt: "2026-09-12" }], [favorite]);
    const original = rankMenuItems(menu.items, profile);
    expect(original[0].dish.id).toBe(favorite.id);
    const ranked = rankMedicationAwareMenu(menu, profile, ["simvastatin"]);
    expect(ranked.at(-1)?.dish.id).toBe(favorite.id);
    for (const item of ranked) expect(item.score).toBe(original.find((entry) => entry.id === item.id)!.score);
    expect(ranked.find((entry) => entry.dish.id === favorite.id)?.tasteRank).toBe(1);
  });

  it.each(["price", "menu", "match"] as const)("does not promote a warning through the %s sort", (sort) => {
    const menu = createMedicationDemoMenu();
    const warning = menu.items.find((item) => item.dish.name === "Pink Grapefruit Spritz")!;
    warning.price = 0;
    warning.menuOrder = -1;
    const ranked = rankMedicationAwareMenu(menu, neutral, ["simvastatin"]);
    const sorted = sortMedicationRecommendations(ranked, sort);
    expect(sorted.at(-1)?.dish.id).toBe(warning.dish.id);
  });

  it("does not manufacture a top pick if every dish needs review", () => {
    const ranked = rankMedicationAwareMenu(createMedicationDemoMenu(), neutral, ["unsupported"]);
    expect(ranked.find((item) => canShortlist(item.medicationCheck))).toBeUndefined();
  });

  it("refuses to screen a sample substituted for an unread photo", () => {
    const menu = createMedicationDemoMenu();
    menu.menu.sourceType = "image";
    const ranked = rankMedicationAwareMenu(menu, neutral, ["simvastatin"]);
    expect(ranked.every((item) => item.medicationCheck.status === "not-checked")).toBe(true);
    expect(ranked[0].medicationCheck.reason).toContain("photo was replaced");
    expect(ranked.some((item) => canShortlist(item.medicationCheck))).toBe(false);
  });

  it("checks explicit text even when the local keyword parser misses an ingredient", () => {
    const menu = processExtractedMenu(parsePastedMenu("Spritz — grapefruit juice and sparkling water 7\nSalad — lettuce and tomato 10"), "text", true);
    const ranked = rankMedicationAwareMenu(menu, neutral, ["simvastatin"]);
    expect(ranked.find((item) => item.dish.name === "Spritz")?.medicationCheck.status).toBe("avoid");
  });

  it("does not mutate input menus, taste profiles, or selections", () => {
    const menu = createMedicationDemoMenu();
    const medications = ["simvastatin"];
    const before = JSON.stringify([menu, neutral, medications]);
    rankMedicationAwareMenu(menu, neutral, medications);
    expect(JSON.stringify([menu, neutral, medications])).toBe(before);
  });
});
