import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cycleTagPreference, EMPTY_MEAL_PREFERENCE_STATE, setMaxPrice, tagPreference, toggleExcludedIngredient, toggleExcludedProteinType } from "./meal-preferences";

describe("meal-preferences source", () => {
  it("never imports the persistent taste engine or taste provider", () => {
    const source = readFileSync(fileURLToPath(new URL("./meal-preferences.ts", import.meta.url)), "utf-8");
    const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
    for (const line of importLines) expect(line).not.toMatch(/taste-provider|@\/lib\/taste/);
  });
});

describe("cycleTagPreference", () => {
  it("cycles neutral -> desired -> avoided -> neutral", () => {
    let state = EMPTY_MEAL_PREFERENCE_STATE;
    expect(tagPreference(state, "spicy")).toBe("neutral");

    state = cycleTagPreference(state, "spicy");
    expect(tagPreference(state, "spicy")).toBe("desired");
    expect(state.desiredTags).toEqual(["spicy"]);

    state = cycleTagPreference(state, "spicy");
    expect(tagPreference(state, "spicy")).toBe("avoided");
    expect(state.desiredTags).toEqual([]);
    expect(state.avoidedTags).toEqual(["spicy"]);

    state = cycleTagPreference(state, "spicy");
    expect(tagPreference(state, "spicy")).toBe("neutral");
    expect(state.avoidedTags).toEqual([]);
  });

  it("tracks multiple tags independently", () => {
    let state = EMPTY_MEAL_PREFERENCE_STATE;
    state = cycleTagPreference(state, "spicy");
    state = cycleTagPreference(cycleTagPreference(state, "filling"), "filling");
    expect(tagPreference(state, "spicy")).toBe("desired");
    expect(tagPreference(state, "filling")).toBe("avoided");
  });
});

describe("toggleExcludedIngredient / toggleExcludedProteinType", () => {
  it("adds then removes an ingredient, case-insensitively", () => {
    let state = toggleExcludedIngredient(EMPTY_MEAL_PREFERENCE_STATE, "Shellfish");
    expect(state.excludedIngredients).toEqual(["Shellfish"]);
    state = toggleExcludedIngredient(state, "shellfish");
    expect(state.excludedIngredients).toEqual([]);
  });

  it("ignores blank input", () => {
    expect(toggleExcludedIngredient(EMPTY_MEAL_PREFERENCE_STATE, "   ")).toEqual(EMPTY_MEAL_PREFERENCE_STATE);
  });

  it("manages protein exclusions independently of ingredients", () => {
    const state = toggleExcludedProteinType(EMPTY_MEAL_PREFERENCE_STATE, "chicken");
    expect(state.excludedProteinTypes).toEqual(["chicken"]);
    expect(state.excludedIngredients).toEqual([]);
  });
});

describe("setMaxPrice", () => {
  it("sets and clears a price ceiling", () => {
    const withPrice = setMaxPrice(EMPTY_MEAL_PREFERENCE_STATE, 15);
    expect(withPrice.maxPrice).toBe(15);
    const cleared = setMaxPrice(withPrice, undefined);
    expect(cleared.maxPrice).toBeUndefined();
  });
});
