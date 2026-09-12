import type { Dish, MenuItem, Rating } from "@/types";
import { buildTasteProfile } from "@/lib/taste/profile";
import { rankMenuItems } from "./scoring";

export interface EvaluationUser {
  id: string;
  ratings: Rating[];
}

export interface HeldOutUserResult {
  userId: string;
  heldOutPositiveDishIds: string[];
  heldOutNegativeDishIds: string[];
  rankedDishIds: string[];
  hitAt1: number | null;
  hitAt3: number | null;
  ndcgAt3: number | null;
  reciprocalRank: number | null;
  pairwiseAccuracy: number | null;
}

export interface RankingEvaluation {
  usersEvaluated: number;
  hitAt1: number | null;
  hitAt3: number | null;
  ndcgAt3: number | null;
  meanReciprocalRank: number | null;
  pairwiseAccuracy: number | null;
  perUser: HeldOutUserResult[];
}

function isPositive(rating: Rating) {
  return rating.value >= 4;
}

function isNegative(rating: Rating) {
  return rating.value <= 2;
}

/** Holds out one latest positive and one latest negative interaction when available. */
export function splitHeldOutRatings(ratings: Rating[]) {
  const ordered = [...ratings].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
  const positive = [...ordered].reverse().find(isPositive);
  const negative = [...ordered].reverse().find(isNegative);
  const heldOutIds = new Set([positive?.id, negative?.id].filter(Boolean));
  return {
    train: ordered.filter((rating) => !heldOutIds.has(rating.id)),
    heldOutPositive: positive ? [positive] : [],
    heldOutNegative: negative ? [negative] : [],
  };
}

function average(values: Array<number | null>) {
  const defined = values.filter((value): value is number => value !== null);
  return defined.length ? defined.reduce((sum, value) => sum + value, 0) / defined.length : null;
}

export function evaluateCosineBaseline(
  users: EvaluationUser[],
  dishes: Dish[],
  candidateItems: MenuItem[],
): RankingEvaluation {
  const perUser = users.map((user) => {
    const split = splitHeldOutRatings(user.ratings);
    const positiveIds = split.heldOutPositive.map((rating) => rating.dishId);
    const negativeIds = split.heldOutNegative.map((rating) => rating.dishId);
    const profile = buildTasteProfile(user.id, split.train, dishes);
    const seenTrainingDishIds = new Set(split.train.map((rating) => rating.dishId));
    const rankedDishIds = rankMenuItems(
      candidateItems.filter((item) => !seenTrainingDishIds.has(item.dish.id)),
      profile,
    ).map((item) => item.dish.id);
    const positiveRanks = positiveIds
      .map((id) => rankedDishIds.indexOf(id) + 1)
      .filter((rank) => rank > 0);
    const firstPositiveRank = positiveRanks.length ? Math.min(...positiveRanks) : null;
    const relevantAt3 = rankedDishIds.slice(0, 3).filter((id) => positiveIds.includes(id)).length;
    const dcg = rankedDishIds.slice(0, 3).reduce(
      (sum, id, index) => sum + (positiveIds.includes(id) ? 1 / Math.log2(index + 2) : 0),
      0,
    );
    const idealDcg = Array.from({ length: Math.min(positiveIds.length, 3) }, (_, index) => 1 / Math.log2(index + 2))
      .reduce((sum, value) => sum + value, 0);
    const pairs = positiveIds.flatMap((positiveId) => negativeIds.map((negativeId) => ({
      positiveRank: rankedDishIds.indexOf(positiveId),
      negativeRank: rankedDishIds.indexOf(negativeId),
    }))).filter((pair) => pair.positiveRank >= 0 && pair.negativeRank >= 0);

    return {
      userId: user.id,
      heldOutPositiveDishIds: positiveIds,
      heldOutNegativeDishIds: negativeIds,
      rankedDishIds,
      hitAt1: positiveIds.length ? (rankedDishIds.slice(0, 1).some((id) => positiveIds.includes(id)) ? 1 : 0) : null,
      hitAt3: positiveIds.length ? (relevantAt3 > 0 ? 1 : 0) : null,
      ndcgAt3: positiveIds.length ? dcg / idealDcg : null,
      reciprocalRank: firstPositiveRank ? 1 / firstPositiveRank : positiveIds.length ? 0 : null,
      pairwiseAccuracy: pairs.length
        ? pairs.filter((pair) => pair.positiveRank < pair.negativeRank).length / pairs.length
        : null,
    };
  });

  return {
    usersEvaluated: perUser.length,
    hitAt1: average(perUser.map((result) => result.hitAt1)),
    hitAt3: average(perUser.map((result) => result.hitAt3)),
    ndcgAt3: average(perUser.map((result) => result.ndcgAt3)),
    meanReciprocalRank: average(perUser.map((result) => result.reciprocalRank)),
    pairwiseAccuracy: average(perUser.map((result) => result.pairwiseAccuracy)),
    perUser,
  };
}
