import { describe, expect, it } from "vitest";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import { EMPTY_MEAL_PREFERENCE_STATE } from "@/lib/session/meal-preferences";
import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import type { GroupDecisionMember, PreferenceQuestion } from "@/types/group";
import { applyPreferenceAnswer } from "./preference-question";

const fixture = GROUP_GOLDEN_FIXTURES.find((entry) => entry.id === "preference-flip")!;

const question: PreferenceQuestion = { id: "q1", memberId: "alex", tag: "spicy", prompt: "Feeling like something spicy today?" };

function withEmptyPreferences(members: GroupDecisionMember[]): GroupDecisionMember[] {
  return members.map((decisionMember) => ({ ...decisionMember, member: { ...decisionMember.member, mealPreferenceState: EMPTY_MEAL_PREFERENCE_STATE } }));
}

describe("applyPreferenceAnswer", () => {
  it("marks the targeted member's tag desired on yes, leaving others untouched", () => {
    const baseline = withEmptyPreferences(fixture.members);
    const updated = applyPreferenceAnswer(baseline, question, "yes");
    const alex = updated.find((member) => member.member.userId === "alex")!;
    expect(alex.member.mealPreferenceState.desiredTags).toEqual(["spicy"]);
  });

  it("marks the targeted member's tag avoided on no", () => {
    const baseline = withEmptyPreferences(fixture.members);
    const updated = applyPreferenceAnswer(baseline, question, "no");
    const alex = updated.find((member) => member.member.userId === "alex")!;
    expect(alex.member.mealPreferenceState.avoidedTags).toEqual(["spicy"]);
  });

  it("does not touch members other than the one targeted", () => {
    const withSecondMember = [...withEmptyPreferences(fixture.members), { member: { sessionId: fixture.session.id, userId: "blair", displayName: "blair", status: "responded" as const, mealPreferenceState: EMPTY_MEAL_PREFERENCE_STATE }, profile: fixture.members[0].profile }];
    const updated = applyPreferenceAnswer(withSecondMember, question, "yes");
    const blair = updated.find((member) => member.member.userId === "blair")!;
    expect(blair.member.mealPreferenceState.desiredTags).toEqual([]);
  });

  it("recomputes the real recommendation and flips the winner once answered yes", () => {
    const baseline = withEmptyPreferences(fixture.members);
    const before = computeGroupRecommendation({ session: fixture.session, venues: fixture.venues, members: baseline });
    expect(before?.winner.id).toBe(fixture.expected.winnerWithoutPreferenceId);

    const answered = applyPreferenceAnswer(baseline, question, "yes");
    const after = computeGroupRecommendation({ session: fixture.session, venues: fixture.venues, members: answered });
    expect(after?.winner.id).toBe(fixture.expected.winnerWithPreferenceId);
    expect(after?.winner.id).not.toBe(before?.winner.id);
  });
});
