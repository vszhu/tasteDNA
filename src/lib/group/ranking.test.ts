import { describe, expect, it } from "vitest";
import { TASTE_DIMENSIONS } from "@/types";
import type { Dish, DishFeatures, MenuItem, TasteFeatureVector, TasteProfile } from "@/types";
import type { DiningSession, GroupDecisionMember, MealPreferenceState, Venue } from "@/types/group";
import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import { GROUP_RANKING_WEIGHTS, computeGroupRecommendation, scoreRestaurantForMember } from "./ranking";

const EMPTY_MEAL_STATE: MealPreferenceState = {
  desiredTags: [],
  avoidedTags: [],
  excludedIngredients: [],
  excludedProteinTypes: [],
};

function tasteFeatures(): DishFeatures {
  return {
    ...Object.fromEntries(TASTE_DIMENSIONS.map((dimension) => [dimension, 0])) as TasteFeatureVector,
    cuisines: [],
    majorIngredients: [],
    proteinTypes: [],
    carbohydrateTypes: [],
    cookingMethods: [],
  };
}

function profile(userId: string, semanticVector: number[]): TasteProfile {
  return {
    id: `profile-${userId}`,
    userId,
    semanticVector,
    attributePreferences: Object.fromEntries(TASTE_DIMENSIONS.map((dimension) => [dimension, 0])) as TasteFeatureVector,
    cuisinePreferences: {},
    cookingMethodPreferences: {},
    favoriteCuisines: [],
    strongestPositiveFlavors: [],
    strongestNegativeFlavors: [],
    favoriteTextures: [],
    preferredCookingStyles: [],
    representativeDishIds: [],
    ratingCount: 1,
    confidence: "early read",
    updatedAt: "2026-09-12",
  };
}

function member(userId: string, semanticVector: number[]): GroupDecisionMember {
  return {
    member: {
      sessionId: "session",
      userId,
      displayName: userId,
      status: "responded",
      mealPreferenceState: EMPTY_MEAL_STATE,
    },
    profile: profile(userId, semanticVector),
  };
}

function venue(id: string, embeddings: number[][]): Venue {
  const menuId = `menu-${id}`;
  const menuItems: MenuItem[] = embeddings.map((embedding, menuOrder) => {
    const dish: Dish = {
      id: `${id}-${menuOrder}`,
      name: `${id}-${menuOrder}`,
      description: "",
      cuisine: "Test",
      ingredients: [],
      embedding,
      features: tasteFeatures(),
    };
    return { id: `item-${dish.id}`, menuId, menuOrder, dish };
  });
  return {
    id,
    name: id,
    location: { latitude: 40, longitude: -79 },
    menuItems,
    menuFreshness: "fresh",
  };
}

function spicyVenue(id: string, embedding: number[]): Venue {
  const candidate = venue(id, [embedding]);
  candidate.menuItems[0].dish.features.spicy = 1;
  return candidate;
}

function session(venues: Venue[]): DiningSession {
  return {
    id: "session",
    title: "fixture",
    createdByUserId: "alex",
    candidateVenueIds: venues.map((candidate) => candidate.id),
    status: "open",
    createdAt: "2026-09-12",
    updatedAt: "2026-09-12",
  };
}

describe("fair group ranking", () => {
  it("rewards choice depth in each member's restaurant utility", () => {
    const alex = member("alex", [1, 0]);
    const shallow = venue("shallow", [[1, 0], [-1, 0]]);
    const deep = venue("deep", [[0.8, 0.6], [0.8, 0.6], [0.8, 0.6]]);

    expect(scoreRestaurantForMember(alex, deep).utility).toBeGreaterThan(
      scoreRestaurantForMember(alex, shallow).utility,
    );
  });

  it("prefers a balanced venue over a high-average venue that fails one member", () => {
    const members = [member("alex", [1, 0]), member("blair", [-1, 0]), member("casey", [1, 0])];
    const unbalanced = venue("unbalanced", [[1, 0]]);
    const balanced = venue("balanced", [[1, 0], [-1, 0]]);
    const result = computeGroupRecommendation({ session: session([unbalanced, balanced]), venues: [unbalanced, balanced], members });

    expect(result?.winner.id).toBe("balanced");
    expect(result?.venueScores.find((score) => score.venue.id === "unbalanced")?.clearsMiseryFloor).toBe(false);
    expect(result?.explanationFacts).toContainEqual({
      kind: "misery-floor",
      value: 15,
      label: "unbalanced is below the misery floor of 45",
      venueId: "unbalanced",
    });
    expect(result?.explanationFacts).toContainEqual({
      kind: "worst-member-protection",
      value: 75,
      label: "Lowest member utility: 75",
      venueId: "balanced",
    });
  });

  it("returns the best compromise when every venue fails the misery floor", () => {
    const alex = member("alex", [1, 0]);
    const first = venue("first", [[-1, 0]]);
    const second = venue("second", [[-0.8, 0.6]]);
    const result = computeGroupRecommendation({ session: session([first, second]), venues: [first, second], members: [alex] });

    expect(result?.compromiseRequired).toBe(true);
    expect(result?.winner.id).toBe("second");
    expect(result?.explanationFacts).toContainEqual({
      kind: "compromise",
      value: -23,
      label: "No venue met the misery floor of 45; selected the best compromise",
      venueId: "second",
    });
  });

  it("uses candidate order as a deterministic tie breaker and assigns one dish per member", () => {
    const members = [member("alex", [1, 0]), member("blair", [0, 1])];
    const first = venue("first", [[1, 0], [0, 1]]);
    const second = venue("second", [[1, 0], [0, 1]]);
    const result = computeGroupRecommendation({ session: session([first, second]), venues: [first, second], members });

    expect(result?.winner.id).toBe("first");
    expect(result?.assignments.map((assignment) => assignment.memberId)).toEqual(["alex", "blair"]);
    expect(result?.explanationFacts).toContainEqual({
      kind: "runner-up-gap",
      value: 0,
      label: "Lead over second: 0",
      venueId: "second",
    });
    expect(result?.explanationFacts).toContainEqual({
      kind: "member-dish-choice",
      value: 85,
      label: "alex's best available dish: first-0",
      venueId: "first",
      memberId: "alex",
      dishId: "first-0",
    });
  });

  it("reports the winner score and runner-up gap for a clear winner", () => {
    const alex = member("alex", [1, 0]);
    const winner = venue("winner", [[1, 0]]);
    const runnerUp = venue("runner-up", [[0.2, 0.98]]);
    const result = computeGroupRecommendation({ session: session([winner, runnerUp]), venues: [winner, runnerUp], members: [alex] });

    expect(result?.explanationFacts).toContainEqual({
      kind: "winner-advantage",
      value: 85,
      label: "Highest fairness-adjusted group score: 85",
      venueId: "winner",
    });
    expect(result?.explanationFacts).toContainEqual({
      kind: "runner-up-gap",
      value: 28,
      label: "Lead over runner-up: 28",
      venueId: "runner-up",
    });
  });

  it("returns null for an empty candidate menu instead of inventing a recommendation", () => {
    const empty = venue("empty", []);
    expect(computeGroupRecommendation({ session: session([empty]), venues: [empty], members: [member("alex", [1, 0])] })).toBeNull();
  });

  it("keeps the misery-floor golden fixture below the inclusive boundary", () => {
    const fixture = GROUP_GOLDEN_FIXTURES.find((candidate) => candidate.id === "misery-floor");
    if (!fixture) throw new Error("Missing misery-floor golden fixture");

    const result = computeGroupRecommendation(fixture);
    const failedVenue = result?.venueScores.find((score) => score.venue.id === "one-member-miss");

    expect(failedVenue?.worstMemberUtility).toBeLessThan(GROUP_RANKING_WEIGHTS.miseryFloor);
    expect(failedVenue?.clearsMiseryFloor).toBe(false);
    expect(result?.compromiseRequired).toBe(false);
  });

  it("marks the all-fail golden fixture as a compromise", () => {
    const fixture = GROUP_GOLDEN_FIXTURES.find((candidate) => candidate.id === "all-fail-compromise");
    if (!fixture) throw new Error("Missing all-fail-compromise golden fixture");

    const result = computeGroupRecommendation(fixture);

    expect(result?.winner.id).toBe(fixture.expected.winnerVenueId);
    expect(result?.venueScores.every((score) => !score.clearsMiseryFloor)).toBe(true);
    expect(result?.compromiseRequired).toBe(true);
    expect(result?.explanationFacts).toContainEqual(expect.objectContaining({
      kind: "compromise",
      venueId: "least-bad",
    }));
  });

  it("returns high confidence and no question for a robust winner", () => {
    const alex = member("alex", [1, 0]);
    const winner = venue("winner", [[1, 0]]);
    const poorFit = venue("poor-fit", [[-1, 0]]);

    const result = computeGroupRecommendation({ session: session([winner, poorFit]), venues: [winner, poorFit], members: [alex] });

    expect(result?.decisionConfidence).toEqual({ level: "high", winnerMargin: 100, isFragile: false });
    expect(result?.preferenceQuestion).toBeUndefined();
  });

  it("asks the preference whose answer can flip a fragile winner", () => {
    const alex = member("alex", [1, 0]);
    const comfort = venue("comfort", [[1, 0]]);
    const spice = spicyVenue("spice", [0.9, Math.sqrt(1 - 0.9 ** 2)]);
    const result = computeGroupRecommendation({ session: session([comfort, spice]), venues: [comfort, spice], members: [alex] });

    expect(result?.winner.id).toBe("comfort");
    expect(result?.decisionConfidence).toEqual({ level: "low", winnerMargin: 3, isFragile: true });
    expect(result?.preferenceQuestion).toEqual({
      id: "session:alex:spicy",
      memberId: "alex",
      tag: "spicy",
      prompt: "Would you like something spicy for this meal?",
    });
  });

  it("uses a stable question choice for identical tied inputs", () => {
    const alex = member("alex", [1, 0]);
    const comfort = venue("comfort", [[1, 0]]);
    const spice = spicyVenue("spice", [0.9, Math.sqrt(1 - 0.9 ** 2)]);
    const input = { session: session([comfort, spice]), venues: [comfort, spice], members: [alex] };

    expect(computeGroupRecommendation(input)?.preferenceQuestion).toEqual(
      computeGroupRecommendation(input)?.preferenceQuestion,
    );
  });
});
