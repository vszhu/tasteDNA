import { describe, expect, it } from "vitest";
import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import { computeGroupRecommendation, scoreRestaurantForMember } from "@/lib/group/ranking";
import type { MedicationAccount } from "@/lib/medications/account";
import { medicationVersionFingerprint, medicationVersions, prepareGroupMedicationChecks } from "./medication-checks";

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
    expect(() => prepareGroupMedicationChecks(input, [account(input.members[0].member.userId)])).toThrow(/Review the menus/);
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
