import { setTagPreference } from "@/lib/session/meal-preferences";
import type { GroupDecisionMember, PreferenceQuestion } from "@/types/group";

export type PreferenceAnswer = "yes" | "no";

/**
 * Applies one member's answer to a targeted PreferenceQuestion, returning a
 * new member list with only that member's mealPreferenceState changed.
 * "yes" marks the question's tag desired, "no" marks it avoided — a clear
 * signal either way, since the point of asking is to resolve ambiguity.
 */
export function applyPreferenceAnswer(members: GroupDecisionMember[], question: PreferenceQuestion, answer: PreferenceAnswer): GroupDecisionMember[] {
  return members.map((decisionMember) => {
    if (decisionMember.member.userId !== question.memberId) return decisionMember;
    return {
      ...decisionMember,
      member: {
        ...decisionMember.member,
        mealPreferenceState: setTagPreference(decisionMember.member.mealPreferenceState, question.tag, answer === "yes" ? "desired" : "avoided"),
      },
    };
  });
}
