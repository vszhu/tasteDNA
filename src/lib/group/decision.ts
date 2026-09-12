import type {
  DecisionConfidence,
  GroupDecisionMember,
  GroupRecommendation,
  MealPreferenceState,
  MealPreferenceTag,
  PreferenceQuestion,
} from "@/types/group";
import { MEAL_PREFERENCE_TAGS } from "@/types/group";

export const DECISION_SUPPORT_CONFIG = {
  lowConfidenceMargin: 7,
  mediumConfidenceMargin: 15,
  winnerFlipBonus: 1_000,
} as const;

export interface DecisionQuestionInput {
  sessionId: string;
  members: GroupDecisionMember[];
  recommendation: GroupRecommendation;
  simulate: (members: GroupDecisionMember[]) => GroupRecommendation | null;
}

function viableScores(recommendation: GroupRecommendation) {
  return recommendation.compromiseRequired
    ? recommendation.venueScores
    : recommendation.venueScores.filter((score) => score.clearsMiseryFloor);
}

/** Computes confidence from the same viable venue scores used to select a winner. */
export function assessDecisionConfidence(recommendation: GroupRecommendation): DecisionConfidence {
  const runnerUp = viableScores(recommendation).find((score) => score.venue.id !== recommendation.winner.id);
  const winnerMargin = runnerUp ? Math.max(0, recommendation.groupScore - runnerUp.groupScore) : 100;
  const isFragile = recommendation.compromiseRequired || winnerMargin <= DECISION_SUPPORT_CONFIG.lowConfidenceMargin;
  const level = isFragile
    ? "low"
    : winnerMargin < DECISION_SUPPORT_CONFIG.mediumConfidenceMargin
      ? "medium"
      : "high";

  return { level, winnerMargin, isFragile };
}

function withResponse(
  state: MealPreferenceState,
  tag: MealPreferenceTag,
  response: "desired" | "avoided",
): MealPreferenceState {
  return {
    ...state,
    desiredTags: response === "desired" ? [...state.desiredTags, tag] : [...state.desiredTags],
    avoidedTags: response === "avoided" ? [...state.avoidedTags, tag] : [...state.avoidedTags],
    excludedIngredients: [...state.excludedIngredients],
    excludedProteinTypes: [...state.excludedProteinTypes],
  };
}

function withMemberResponse(
  members: GroupDecisionMember[],
  memberId: string,
  tag: MealPreferenceTag,
  response: "desired" | "avoided",
) {
  return members.map((candidate) => candidate.member.userId !== memberId
    ? candidate
    : {
      ...candidate,
      member: {
        ...candidate.member,
        mealPreferenceState: withResponse(candidate.member.mealPreferenceState, tag, response),
      },
    });
}

function questionImpact(
  baseline: GroupRecommendation,
  simulated: GroupRecommendation | null,
) {
  if (!simulated) return 0;
  const baselineConfidence = assessDecisionConfidence(baseline);
  const simulatedConfidence = assessDecisionConfidence(simulated);
  const winnerChanged = simulated.winner.id !== baseline.winner.id;
  return Math.abs(simulatedConfidence.winnerMargin - baselineConfidence.winnerMargin) +
    (winnerChanged ? DECISION_SUPPORT_CONFIG.winnerFlipBonus : 0);
}

/**
 * Selects one unanswered yes/no meal-preference question only when an answer
 * can materially move a fragile group decision. "Yes" adds the tag to
 * desiredTags; "No" adds it to avoidedTags through the existing meal-state
 * pipeline.
 */
export function generateDecisionQuestion(input: DecisionQuestionInput): PreferenceQuestion | undefined {
  if (!assessDecisionConfidence(input.recommendation).isFragile) return undefined;

  let bestQuestion: PreferenceQuestion | undefined;
  let bestImpact = 0;

  for (const member of input.members) {
    if (member.member.status === "declined") continue;
    const state = member.member.mealPreferenceState;
    for (const tag of MEAL_PREFERENCE_TAGS) {
      if (state.desiredTags.includes(tag) || state.avoidedTags.includes(tag)) continue;

      const desired = input.simulate(withMemberResponse(input.members, member.member.userId, tag, "desired"));
      const avoided = input.simulate(withMemberResponse(input.members, member.member.userId, tag, "avoided"));
      const impact = Math.max(
        questionImpact(input.recommendation, desired),
        questionImpact(input.recommendation, avoided),
      );
      if (impact <= bestImpact) continue;

      bestImpact = impact;
      bestQuestion = {
        id: `${input.sessionId}:${member.member.userId}:${tag}`,
        memberId: member.member.userId,
        tag,
        prompt: `Would you like something ${tag} for this meal?`,
      };
    }
  }

  return bestQuestion;
}
