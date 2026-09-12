import { describe, expect, it } from "vitest";
import { TASTE_DIMENSIONS } from "@/types";
import type { Dish, DishFeatures, MenuItem, TasteFeatureVector, TasteProfile } from "@/types";
import type { DiningSession, GroupDecisionMember, MealPreferenceState, Venue } from "@/types/group";
import { computeGroupRecommendation, scoreRestaurantForMember } from "./ranking";

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
  });

  it("returns the best compromise when every venue fails the misery floor", () => {
    const alex = member("alex", [1, 0]);
    const first = venue("first", [[-1, 0]]);
    const second = venue("second", [[-0.8, 0.6]]);
    const result = computeGroupRecommendation({ session: session([first, second]), venues: [first, second], members: [alex] });

    expect(result?.compromiseRequired).toBe(true);
    expect(result?.winner.id).toBe("second");
  });

  it("uses candidate order as a deterministic tie breaker and assigns one dish per member", () => {
    const members = [member("alex", [1, 0]), member("blair", [0, 1])];
    const first = venue("first", [[1, 0], [0, 1]]);
    const second = venue("second", [[1, 0], [0, 1]]);
    const result = computeGroupRecommendation({ session: session([first, second]), venues: [first, second], members });

    expect(result?.winner.id).toBe("first");
    expect(result?.assignments.map((assignment) => assignment.memberId)).toEqual(["alex", "blair"]);
  });

  it("returns null for an empty candidate menu instead of inventing a recommendation", () => {
    const empty = venue("empty", []);
    expect(computeGroupRecommendation({ session: session([empty]), venues: [empty], members: [member("alex", [1, 0])] })).toBeNull();
  });
});
