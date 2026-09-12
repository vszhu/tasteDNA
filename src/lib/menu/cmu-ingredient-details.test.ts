import { describe, expect, it } from "vitest";
import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import { checkDishMedications } from "@/lib/medications/check";
import { MEDICATION_CATALOG } from "@/lib/medications/catalog";
import { prepareGroupMedicationChecks } from "@/lib/group-sessions/medication-checks";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import type { MenuItem } from "@/types";
import { applyConfirmedCmuIngredientDetails, CMU_ABP_MENU_URL, type CmuMenuSource } from "./cmu-ingredient-details";

const source: CmuMenuSource = {
  sourceProvider: "cmu-dining-dataset-v2", sourceUri: CMU_ABP_MENU_URL,
  sourceMetadata: { datasetId: 113, datasetGeneratedDate: "2026-09-11", dishDetailsInferredFromNames: true },
};
function importedItem(name = "Extra Bacon BLT"): MenuItem {
  const item = structuredClone(GROUP_GOLDEN_FIXTURES[0].venues[0].menuItems[0]);
  item.dish.name = name;
  item.dish.description = "Description inferred from name";
  item.dish.ingredients = [];
  item.dish.features.majorIngredients = ["inferred ingredient"];
  item.dish.features.unknownFields = ["ingredients", "description", "price", "preparation"];
  return item;
}

describe("published CMU ingredient details", () => {
  it("repairs the exact source dish without mutating identity, taste data, or other unknowns", () => {
    const original = importedItem();
    const snapshot = structuredClone(original);
    const item = applyConfirmedCmuIngredientDetails(original, source);
    expect(original).toEqual(snapshot);
    expect(item).toMatchObject({ id: original.id, menuId: original.menuId, menuOrder: original.menuOrder, price: original.price });
    expect(item.dish).toMatchObject({
      id: original.dish.id, name: original.dish.name, embedding: original.dish.embedding,
      ingredients: ["toasted rustic baguette", "hardwood smoked bacon", "tomatoes", "field greens", "mayo"],
      ingredientSource: { kind: "published-menu", url: CMU_ABP_MENU_URL, checkedAt: "2026-09-12" },
    });
    expect(item.dish.features).toEqual({ ...original.dish.features, majorIngredients: item.dish.ingredients, unknownFields: ["price", "preparation"] });
    expect(item.dish.description).toContain("subingredients, and current availability need confirmation");
    expect(checkDishMedications(item.dish, ["simvastatin"]).status).toBe("no-listed-match");
  });

  it.each([
    {},
    { ...source, sourceProvider: "user-decoded" },
    { ...source, sourceUri: "https://example.com/other-menu.pdf" },
    { ...source, sourceMetadata: { ...source.sourceMetadata, datasetId: 114 } },
    { ...source, sourceMetadata: { ...source.sourceMetadata, datasetGeneratedDate: "2026-09-13" } },
    { ...source, sourceMetadata: { ...source.sourceMetadata, dishDetailsInferredFromNames: false } },
  ])("leaves another source or later dataset unchanged: %j", (otherSource) => {
    const item = importedItem();
    expect(applyConfirmedCmuIngredientDetails(item, otherSource)).toBe(item);
  });

  it("preserves new ingredient evidence and its existing warning instead of overwriting it", () => {
    const item = importedItem();
    item.dish.ingredients = ["grapefruit juice"];
    item.dish.description = "A changed recipe with grapefruit juice.";
    const result = applyConfirmedCmuIngredientDetails(item, source);
    expect(result).toBe(item);
    expect(checkDishMedications(result.dish, ["simvastatin"]).status).toBe("avoid");
  });

  it("does not infer details for unmatched dishes, wraps, variants, or categories", () => {
    for (const name of ["Mediterranean Wrap", "Mediterranean", "Extra Bacon BLT with grapefruit", "Hot Oatmeal", "Soups"]) {
      const item = importedItem(name);
      const result = applyConfirmedCmuIngredientDetails(item, source);
      expect(result).toBe(item);
      expect(checkDishMedications(result.dish, ["simvastatin"])).toMatchObject({ status: "review", needsIngredientDetails: true });
    }
  });

  it("keeps unsupported medications in review after adding genuine menu details", () => {
    const item = applyConfirmedCmuIngredientDetails(importedItem(), source);
    expect(checkDishMedications(item.dish, ["unknown medication"]).status).toBe("review");
  });

  it("provides a checked group option from real published components without bypassing exclusions", () => {
    const input = structuredClone(GROUP_GOLDEN_FIXTURES[0]);
    const item = applyConfirmedCmuIngredientDetails(importedItem(), source);
    const incomplete = importedItem("Hot Oatmeal");
    incomplete.id = "incomplete-oatmeal";
    input.venues = [{ ...input.venues[0], menuItems: [item, incomplete] }];
    const userId = input.members[0].member.userId;
    const checked = prepareGroupMedicationChecks(input, [{
      user_id: userId, medications: MEDICATION_CATALOG.map((medication) => medication.id),
      use_in_groups: true, revision: "e1000000-0000-4000-8000-000000000001", updated_at: "2026-09-12T12:00:00Z",
    }]);
    expect(checked.summary).toMatchObject({ checkedMembers: 1, flaggedDishOptions: 1, withheldVenues: 0 });
    expect(checked.input.members[0].medicationExcludedItemIds).toEqual([incomplete.id]);
    const result = computeGroupRecommendation(checked.input)!;
    expect(result.assignments.find((assignment) => assignment.memberId === userId)?.dishUtility).toMatchObject({ menuItemId: item.id, excluded: false });
  });
});
