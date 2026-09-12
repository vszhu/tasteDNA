import { describe, expect, it } from "vitest";
import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import { computeGroupRecommendation, scoreRestaurantForMember } from "@/lib/group/ranking";
import type { MedicationAccount } from "@/lib/medications/account";
import { medicationVersionFingerprint, medicationVersions, prepareGroupMedicationChecks } from "./medication-checks";
import { GroupSessionError } from "./types";

function fixture() {
  const input = structuredClone(GROUP_GOLDEN_FIXTURES[0]);
  input.venues.forEach((venue, v) => venue.menuItems.forEach((item, i) => {
    item.dish.name = v === 0 || i === 0 ? "Grapefruit bowl" : "Rice bowl";
    item.dish.description = item.dish.name;
    item.dish.ingredients = v === 0 || i === 0 ? ["grapefruit", "rice"] : ["rice"];
  }));
  return input;
}
function account(userId: string, overrides: Partial<MedicationAccount> = {}): MedicationAccount {
  return { user_id: userId, medications: ["simvastatin"], use_in_groups: true, revision: "e1000000-0000-4000-8000-000000000001", updated_at: "2026-09-12T12:00:00Z", ...overrides };
}

describe("private medication checks in real group computation", () => {
  it("preserves the taste-only result for members who have not opted in", () => {
    const input = fixture();
    const checked = prepareGroupMedicationChecks(input, [account(input.members[0].member.userId, { use_in_groups: false })]);
    expect(checked.input).toBe(input);
    expect(computeGroupRecommendation(checked.input)).toEqual(computeGroupRecommendation(input));
    expect(checked.summary.checkedMembers).toBe(0);
  });

  it("withholds unsuitable venues and flagged assignments without changing taste scores", () => {
    const input = fixture();
    // Give every remaining venue an explicit alternative even if the golden menu has one item.
    input.venues.slice(1).forEach((venue) => venue.menuItems.push({ ...structuredClone(venue.menuItems[0]), id: `${venue.id}-rice`, menuOrder: 10, dish: { ...structuredClone(venue.menuItems[0].dish), id: `${venue.id}-rice`, name: "Rice bowl", description: "Steamed rice", ingredients: ["rice"] } }));
    const checked = prepareGroupMedicationChecks(input, [account(input.members[0].member.userId)]);
    expect(checked.input.venues.map((entry) => entry.id)).not.toContain(input.venues[0].id);
    const result = computeGroupRecommendation(checked.input)!;
    const assignment = result.assignments.find((entry) => entry.memberId === input.members[0].member.userId)!;
    expect(assignment.dishUtility.dish.ingredients).toEqual(["rice"]);
    expect(assignment.dishUtility.excluded).toBe(false);
    const before = scoreRestaurantForMember(input.members[0], input.venues[1]);
    const after = scoreRestaurantForMember(checked.input.members[0], input.venues[1]);
    expect(after.dishUtilities.map((entry) => entry.baseScore)).toEqual(before.dishUtilities.map((entry) => entry.baseScore));
    expect(JSON.stringify({ ...result, medicationSummary: checked.summary })).not.toMatch(/simvastatin|e1000000|user_medication_profiles/);
  });

  it("requires review when an opted-in member has an unsupported medicine", () => {
    const input = fixture();
    expect(() => prepareGroupMedicationChecks(input, [account(input.members[0].member.userId, { medications: ["unverified test medicine"] })])).toThrow(/no unchecked dish was assigned/);
  });

  it("requires review when menus lack ingredient evidence", () => {
    const input = structuredClone(GROUP_GOLDEN_FIXTURES[0]);
    input.venues.forEach((venue) => venue.menuItems.forEach((item) => { item.dish.ingredients = []; }));
    try {
      prepareGroupMedicationChecks(input, [account(input.members[0].member.userId)]);
      expect.fail("Missing ingredients must not produce assignments.");
    } catch (error) {
      expect(error).toBeInstanceOf(GroupSessionError);
      const review = (error as GroupSessionError).review;
      expect(review).toEqual({
        kind: "menu-review-required",
        checkedMembers: 1,
        totalMembers: input.members.length,
        venues: input.venues.map((venue) => ({ venueId: venue.id, venueName: venue.name, totalDishes: venue.menuItems.length, missingIngredientDishes: venue.menuItems.length })),
      });
      expect(JSON.stringify(review)).not.toMatch(/simvastatin|revision|user_id|memberId|profile/);
    }
  });

  it.each(["simvastatin", "unverified test medicine"])("keeps %s review blocked even when ingredient details are present", (medicine) => {
    const input = fixture();
    input.venues.forEach((venue) => venue.menuItems.forEach((item) => {
      item.dish.name = "Grapefruit bowl";
      item.dish.description = "Grapefruit and rice";
      item.dish.ingredients = ["grapefruit", "rice"];
      item.dish.features.unknownFields = [];
    }));
    try {
      prepareGroupMedicationChecks(input, [account(input.members[0].member.userId, { medications: [medicine] })]);
      expect.fail("Warnings and unsupported medicines still require private review.");
    } catch (error) {
      expect(error).toBeInstanceOf(GroupSessionError);
      expect((error as GroupSessionError).review?.venues.every((venue) => venue.missingIngredientDishes === 0)).toBe(true);
      expect(JSON.stringify((error as GroupSessionError).review)).not.toContain(medicine);
    }
  });

  it("does not blame medications when only meal preferences prevent all assignments", () => {
    const input = fixture();
    input.venues.forEach((venue) => venue.menuItems.forEach((item) => {
      item.dish.name = "Rice bowl";
      item.dish.description = "Steamed rice";
      item.dish.ingredients = ["rice"];
      item.dish.features.majorIngredients = ["rice"];
      item.dish.features.unknownFields = [];
    }));
    input.members[0].member.mealPreferenceState.excludedIngredients = ["rice"];
    try {
      prepareGroupMedicationChecks(input, [account(input.members[0].member.userId)]);
      expect.fail("The opted-in group must still have an eligible dish for each member.");
    } catch (error) {
      expect(error).toBeInstanceOf(GroupSessionError);
      expect((error as GroupSessionError).message).toMatch(/meal preferences/);
      expect((error as GroupSessionError).review).toBeUndefined();
    }
  });

  it("preserves taste-only behavior for an opted-in empty list even with meal exclusions", () => {
    const input = fixture();
    input.members[0].member.mealPreferenceState.excludedIngredients = ["rice"];
    const checked = prepareGroupMedicationChecks(input, [account(input.members[0].member.userId, { medications: [] })]);
    expect(checked.input).toBe(input);
    expect(checked.summary).toMatchObject({ checkedMembers: 1, flaggedDishOptions: 0, withheldVenues: 0 });
    expect(computeGroupRecommendation(checked.input)).toEqual(computeGroupRecommendation(input));
  });

  it("ignores lists belonging to outsiders and members who declined", () => {
    const input = fixture();
    input.members[0].member.status = "declined";
    const checked = prepareGroupMedicationChecks(input, [account(input.members[0].member.userId), account("outsider")]);
    expect(checked.summary.checkedMembers).toBe(0);
    expect(checked.summary.uncheckedMembers).toBe(input.members.length - 1);
    expect(Object.keys(checked.versions)).not.toContain(input.members[0].member.userId);
  });

  it("lets a member explicitly save an empty list without inventing a medication warning", () => {
    const input = fixture();
    const checked = prepareGroupMedicationChecks(input, [account(input.members[0].member.userId, { medications: [] })]);
    expect(checked.summary).toMatchObject({ checkedMembers: 1, flaggedDishOptions: 0, withheldVenues: 0 });
  });

  it("fingerprints random account revisions and changes when consent/list versions change", () => {
    const a = account("a");
    const versions = medicationVersions(["b", "a"], [a]);
    expect(versions).toEqual({ a: a.revision, b: "none" });
    expect(medicationVersionFingerprint(versions)).toBe(medicationVersionFingerprint({ b: "none", a: a.revision }));
    expect(medicationVersionFingerprint(versions)).not.toBe(medicationVersionFingerprint({ ...versions, a: "new-random-revision" }));
  });
});
