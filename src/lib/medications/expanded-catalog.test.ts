import { describe, expect, it } from "vitest";
import type { Dish } from "@/types";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { buildTasteProfile } from "@/lib/taste/profile";
import { parsePastedMenu, processExtractedMenu } from "@/lib/menu/process";
import { rankMenuItems } from "@/lib/recommendation/scoring";
import { MEDICATION_CATALOG, findMedication } from "./catalog";
import { checkDishMedications, rankMedicationAwareMenu } from "./check";

function dish(description: string): Dish {
  return { ...SEED_DISHES[0], name: "Menu item", description, ingredients: ["water"], features: { ...SEED_DISHES[0].features, majorIngredients: ["water"], unknownFields: [] } };
}

describe("expanded medication coverage", () => {
  it.each([
    ["Lipitor", "atorvastatin-tablets"], ["Synthroid", "levothyroxine-tablets"],
    ["Cipro tablets", "ciprofloxacin-tablets"], ["Flagyl tablets", "metronidazole-tablets"],
    ["Aldactone", "spironolactone-tablets"], ["BuSpar", "buspirone-tablets"],
    ["Fosamax tablets", "alendronate-tablets"], ["Nardil", "phenelzine-tablets"],
  ])("finds the reviewed form for %s", (alias, id) => {
    expect(findMedication(alias)?.id).toBe(id);
  });

  it.each(["metronidazole gel", "ciprofloxacin eye drops", "Cipro XR", "Allegra-D", "alendronate effervescent tablets", "levothyroxine liquid", "spironolactone hydrochlorothiazide", "metronidazole 500 mg"])("does not guess a combination, dose, or unreviewed form: %s", (name) => {
    expect(findMedication(name)).toBeUndefined();
    expect(checkDishMedications(dish("Rice and herbs"), [name]).status).toBe("review");
  });

  it("keeps catalog identity and rule IDs unambiguous", () => {
    const rules = MEDICATION_CATALOG.flatMap((entry) => entry.rules.map((rule) => rule.id));
    expect(new Set(rules).size).toBe(rules.length);
    for (const entry of MEDICATION_CATALOG) {
      expect(findMedication(entry.id)).toBe(entry);
      for (const alias of entry.aliases) expect(findMedication(alias)).toBe(entry);
    }
  });

  it("does not apply simvastatin's stronger juice warning to atorvastatin", () => {
    const item = dish("Grapefruit juice spritz");
    expect(checkDishMedications(item, ["atorvastatin-tablets"]).status).toBe("review");
    expect(checkDishMedications(item, ["simvastatin"]).status).toBe("avoid");
  });

  it("keeps levothyroxine food guidance specific to reviewed ingredients", () => {
    const result = checkDishMedications(dish("Soy milk, walnuts, and high-fiber cereal"), ["levothyroxine-tablets"]);
    expect(result.status).toBe("review");
    expect(result.findings[0].explanation).toContain("prescribed food schedule");
    expect(checkDishMedications(dish("Almonds and rice milk"), ["levothyroxine-tablets"]).findings).toEqual([]);
  });

  it("treats ciprofloxacin dairy as a dosing-context review, including dairy within a full meal", () => {
    for (const text of ["Yogurt", "Chicken and rice with yogurt sauce", "Calcium-fortified orange juice"]) {
      const result = checkDishMedications(dish(text), ["ciprofloxacin-tablets"]);
      expect(result.status).toBe("review");
      expect(result.findings[0].explanation).toContain("a meal containing them is allowed");
    }
    expect(checkDishMedications(dish("Orange juice"), ["ciprofloxacin-tablets"]).findings).toEqual([]);
  });

  it("retains ciprofloxacin caffeine quantity guidance without a blanket prohibition", () => {
    const result = checkDishMedications(dish("Coffee and dark chocolate"), ["ciprofloxacin-tablets"]);
    expect(result.status).toBe("review");
    expect(result.findings[0].explanation).toContain("large amounts");
  });

  it("keeps salt-substitute warnings separate from individualized potassium-food guidance", () => {
    expect(checkDishMedications(dish("Seasoned with potassium chloride"), ["spironolactone-tablets"]).status).toBe("avoid");
    const fruit = checkDishMedications(dish("Bananas with raisins and orange juice"), ["spironolactone-tablets"]);
    expect(fruit.status).toBe("review");
    expect(fruit.findings[0].explanation).toContain("not a personalized potassium limit");
    expect(checkDishMedications(dish("Seasoned with table salt"), ["spironolactone-tablets"]).findings).toEqual([]);
  });

  it("distinguishes buspirone grapefruit quantity guidance from alcohol warnings", () => {
    expect(checkDishMedications(dish("Grapefruit salad"), ["buspirone-tablets"]).status).toBe("review");
    expect(checkDishMedications(dish("Vodka with soda water"), ["buspirone-tablets"]).status).toBe("avoid");
  });

  it("does not turn alendronate's dosing routine into an all-day drink ban", () => {
    const result = checkDishMedications(dish("Coffee with milk and sparkling water"), ["alendronate-tablets"]);
    expect(result.status).toBe("review");
    expect(result.findings[0].explanation).toContain("does not prohibit these drinks throughout the day");
    expect(checkDishMedications(dish("Plain water"), ["alendronate-tablets"]).findings).toEqual([]);
  });

  it("keeps phenelzine preparation/caffeine uncertainty visible", () => {
    const result = checkDishMedications(dish("Smoked salmon with aged cheddar and tea"), ["phenelzine-tablets"]);
    expect(result.status).toBe("review");
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["phenelzine-tyramine", "phenelzine-caffeine"]);
    expect(checkDishMedications(dish("Fresh salmon with rice"), ["phenelzine-tablets"]).findings).toEqual([]);
  });
});

describe("alcohol evidence and shared menu integration", () => {
  it.each(["Root beer", "Ginger beer", "Non-alcoholic beer", "Alcohol-free wine", "Red wine vinegar", "Beer-battered fish", "Rum cake", "Red wine sauce"])("reviews ambiguous preparation instead of asserting alcohol: %s", (text) => {
    const result = checkDishMedications(dish(text), ["metronidazole-tablets"]);
    expect(result.status).toBe("review");
    expect(result.findings[0].evidence).toBe("qualified-mention");
  });

  it("does not let a qualified phrase hide a separate explicit alcohol ingredient", () => {
    const result = checkDishMedications(dish("Root beer and vodka"), ["metronidazole-tablets", "buspirone-tablets"]);
    expect(result.status).toBe("avoid");
    expect(result.findings).toHaveLength(2);
    for (const finding of result.findings) expect(finding.termEvidence).toEqual([
      { term: "beer", evidence: "qualified-mention" }, { term: "vodka", evidence: "menu-text" },
    ]);
  });

  it("retains the metronidazole after-treatment window and propylene-glycol warning", () => {
    const result = checkDishMedications(dish("Flavoring contains propylene glycol"), ["metronidazole-tablets"]);
    expect(result.status).toBe("avoid");
    expect(result.findings[0].explanation).toContain("at least three days afterward");
  });

  it("connects new medicines to pasted menus without changing taste scores or input data", () => {
    const menu = processExtractedMenu(parsePastedMenu("Walnut Bowl — walnuts and rice 12\nVodka Soda — vodka and sparkling water 8\nGarden Plate — rice and carrots 10"), "text", true);
    const profile = buildTasteProfile("test", [], []);
    const selections = ["levothyroxine-tablets", "metronidazole-tablets"];
    const original = rankMenuItems(menu.items, profile);
    const before = JSON.stringify([menu, profile, selections]);
    const ranked = rankMedicationAwareMenu(menu, profile, selections);
    expect(ranked.find((item) => item.dish.name === "Walnut Bowl")?.medicationCheck.status).toBe("review");
    expect(ranked.find((item) => item.dish.name === "Vodka Soda")?.medicationCheck.status).toBe("avoid");
    for (const item of ranked) expect(item.score).toBe(original.find((entry) => entry.id === item.id)?.score);
    expect(JSON.stringify([menu, profile, selections])).toBe(before);
  });
});
