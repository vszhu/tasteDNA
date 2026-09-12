import type {
  DiningSession,
  GroupExplanationFact,
  GroupDecisionMember,
  GroupRecommendation,
  MemberDishAssignment,
  RestaurantUtility,
  Venue,
  VenueGroupScore,
  VenueSummary,
} from "@/types/group";
import { scoreDishForMeal } from "@/lib/recommendation/meal-utility";
import { assessDecisionConfidence, generateDecisionQuestion } from "./decision";

export const GROUP_RANKING_WEIGHTS = {
  bestDish: 0.7,
  topThreeMean: 0.3,
  groupMean: 0.65,
  worstMember: 0.35,
  miseryFloor: 45,
} as const;

export interface GroupRankingInput {
  session: DiningSession;
  venues: Venue[];
  members: GroupDecisionMember[];
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function venueSummary(venue: Venue): VenueSummary {
  const { id, name, description, location, menuFreshness } = venue;
  return { id, name, description, location, menuFreshness };
}

function orderedDishUtilities(utility: RestaurantUtility, venue: Venue) {
  const menuOrder = new Map(venue.menuItems.map((item) => [item.id, item.menuOrder]));
  return utility.dishUtilities.filter((entry) => !entry.excluded).sort(
    (left, right) => right.utility - left.utility || (menuOrder.get(left.menuItemId) ?? 0) - (menuOrder.get(right.menuItemId) ?? 0),
  );
}

/** Derives one member's restaurant utility from concrete menu-item utilities. */
export function scoreRestaurantForMember(member: GroupDecisionMember, venue: Venue): RestaurantUtility {
  const dishUtilities = venue.menuItems.map((menuItem) => scoreDishForMeal({
    memberId: member.member.userId,
    venueId: venue.id,
    menuItem,
    profile: member.profile,
    mealPreferenceState: member.member.mealPreferenceState,
  })).map((utility) => member.medicationExcludedItemIds?.includes(utility.menuItemId) ? {
    ...utility,
    utility: 0,
    contextAdjustment: -utility.baseScore,
    excluded: true,
    exclusionReason: "Needs review against private medication guidance.",
    factors: [{ label: "Private medication review required", contribution: -utility.baseScore, kind: "constraint" as const }],
  } : utility);
  const eligible = dishUtilities.filter((utility) => !utility.excluded).sort((left, right) => right.utility - left.utility);
  const bestDishUtility = eligible[0]?.utility ?? 0;
  const topThree = eligible.slice(0, 3).map((utility) => utility.utility);
  const topThreeMeanUtility = topThree.length ? average(topThree) : 0;

  return {
    memberId: member.member.userId,
    venue: venueSummary(venue),
    dishUtilities,
    bestDishUtility,
    topThreeMeanUtility,
    utility: Math.round(
      bestDishUtility * GROUP_RANKING_WEIGHTS.bestDish +
      topThreeMeanUtility * GROUP_RANKING_WEIGHTS.topThreeMean,
    ),
  };
}

function scoreVenue(
  venue: Venue,
  members: GroupDecisionMember[],
): VenueGroupScore {
  const restaurantUtilities = members.map((member) => scoreRestaurantForMember(member, venue));
  const memberUtilities = restaurantUtilities.map((utility) => utility.utility);
  const groupMeanUtility = average(memberUtilities);
  const worstMemberUtility = Math.min(...memberUtilities);
  const groupScore = Math.round(
    groupMeanUtility * GROUP_RANKING_WEIGHTS.groupMean +
    worstMemberUtility * GROUP_RANKING_WEIGHTS.worstMember,
  );

  return {
    venue: venueSummary(venue),
    restaurantUtilities,
    groupScore,
    groupMeanUtility,
    worstMemberUtility,
    clearsMiseryFloor: worstMemberUtility >= GROUP_RANKING_WEIGHTS.miseryFloor,
  };
}

function sortedScores(scores: VenueGroupScore[], venueOrder: Map<string, number>) {
  return [...scores].sort(
    (left, right) => right.groupScore - left.groupScore ||
      right.worstMemberUtility - left.worstMemberUtility ||
      (venueOrder.get(left.venue.id) ?? Number.MAX_SAFE_INTEGER) -
        (venueOrder.get(right.venue.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

function assignments(
  score: VenueGroupScore,
  venue: Venue,
): MemberDishAssignment[] {
  return score.restaurantUtilities.flatMap((utility) => {
    const dishUtility = orderedDishUtilities(utility, venue)[0];
    return dishUtility ? [{ memberId: utility.memberId, dishUtility }] : [];
  });
}

/**
 * Produces presentation-ready facts exclusively from the already-computed
 * ranking intermediates. Labels are deterministic summaries, not generated
 * explanations; consumers can instead render the typed values directly.
 */
function explanationFacts(
  winnerScore: VenueGroupScore,
  runnerUpScore: VenueGroupScore | undefined,
  venueScores: VenueGroupScore[],
  winnerAssignments: MemberDishAssignment[],
  members: GroupDecisionMember[],
  compromiseRequired: boolean,
): GroupExplanationFact[] {
  const facts: GroupExplanationFact[] = [
    {
      kind: "winner-advantage",
      value: winnerScore.groupScore,
      label: `Highest fairness-adjusted group score: ${winnerScore.groupScore}`,
      venueId: winnerScore.venue.id,
    },
    {
      kind: "worst-member-protection",
      value: winnerScore.worstMemberUtility,
      label: `Lowest member utility: ${winnerScore.worstMemberUtility}`,
      venueId: winnerScore.venue.id,
    },
  ];

  if (runnerUpScore) {
    const gap = winnerScore.groupScore - runnerUpScore.groupScore;
    facts.push({
      kind: "runner-up-gap",
      value: gap,
      label: `Lead over ${runnerUpScore.venue.name}: ${gap}`,
      venueId: runnerUpScore.venue.id,
    });
  }

  facts.push(...venueScores
    .filter((score) => !score.clearsMiseryFloor)
    .map((score) => ({
      kind: "misery-floor" as const,
      value: score.worstMemberUtility,
      label: `${score.venue.name} is below the misery floor of ${GROUP_RANKING_WEIGHTS.miseryFloor}`,
      venueId: score.venue.id,
    })));

  if (compromiseRequired) {
    facts.push({
      kind: "compromise",
      value: winnerScore.worstMemberUtility - GROUP_RANKING_WEIGHTS.miseryFloor,
      label: `No venue met the misery floor of ${GROUP_RANKING_WEIGHTS.miseryFloor}; selected the best compromise`,
      venueId: winnerScore.venue.id,
    });
  }

  const memberNames = new Map(members.map((member) => [member.member.userId, member.member.displayName]));
  facts.push(...winnerAssignments.map((assignment) => ({
    kind: "member-dish-choice" as const,
    value: assignment.dishUtility.utility,
    label: `${memberNames.get(assignment.memberId) ?? assignment.memberId}'s best available dish: ${assignment.dishUtility.dish.name}`,
    venueId: assignment.dishUtility.venueId,
    memberId: assignment.memberId,
    dishId: assignment.dishUtility.dish.id,
  })));

  return facts;
}

/**
 * Selects a restaurant fairly from actual dishes. If no venue clears the misery
 * floor, returns the best compromise and labels it instead of returning nothing.
 */
function computeBaseGroupRecommendation(input: GroupRankingInput): GroupRecommendation | null {
  const activeMembers = input.members.filter((member) => member.member.status !== "declined");
  if (activeMembers.length === 0) return null;

  const venueById = new Map(input.venues.map((venue) => [venue.id, venue]));
  const venueOrder = new Map(input.session.candidateVenueIds.map((id, index) => [id, index]));
  const candidates = input.session.candidateVenueIds
    .map((id) => venueById.get(id))
    .filter((venue): venue is Venue => Boolean(venue && venue.menuItems.length > 0));
  if (candidates.length === 0) return null;

  const venueScores = sortedScores(candidates.map((venue) => scoreVenue(venue, activeMembers)), venueOrder);
  const floorClearers = venueScores.filter((score) => score.clearsMiseryFloor);
  const rankedCandidates = floorClearers.length ? floorClearers : venueScores;
  const winnerScore = rankedCandidates[0];
  const winnerVenue = venueById.get(winnerScore.venue.id);
  if (!winnerVenue) return null;
  // A runner-up must be a venue that was eligible to win. Floor-rejected
  // venues remain in venueScores and explanation facts, but are not presented
  // as the next group choice.
  const runnerUpScore = rankedCandidates.find((score) => score.venue.id !== winnerScore.venue.id);
  const winnerAssignments = assignments(winnerScore, winnerVenue);
  const compromiseRequired = floorClearers.length === 0;

  return {
    sessionId: input.session.id,
    winner: winnerScore.venue,
    groupScore: winnerScore.groupScore,
    groupMeanUtility: winnerScore.groupMeanUtility,
    worstMemberUtility: winnerScore.worstMemberUtility,
    miseryFloor: GROUP_RANKING_WEIGHTS.miseryFloor,
    compromiseRequired,
    assignments: winnerAssignments,
    restaurantUtilities: winnerScore.restaurantUtilities,
    venueScores,
    runnerUp: runnerUpScore?.venue,
    explanationFacts: explanationFacts(
      winnerScore,
      runnerUpScore,
      venueScores,
      winnerAssignments,
      activeMembers,
      compromiseRequired,
    ),
  };
}

/**
 * Selects a fair group recommendation and, only for fragile decisions, returns
 * one deterministic meal-preference question with the largest simulated impact.
 */
export function computeGroupRecommendation(input: GroupRankingInput): GroupRecommendation | null {
  const recommendation = computeBaseGroupRecommendation(input);
  if (!recommendation) return null;

  const decisionConfidence = assessDecisionConfidence(recommendation);
  const preferenceQuestion = generateDecisionQuestion({
    sessionId: input.session.id,
    members: input.members,
    recommendation,
    simulate: (members) => computeBaseGroupRecommendation({ ...input, members }),
  });

  return { ...recommendation, decisionConfidence, preferenceQuestion };
}
