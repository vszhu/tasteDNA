import { TASTE_DIMENSIONS } from "./index";
import type { Dish, DishFeatures, MenuItem, TasteFeatureVector, TasteProfile } from "./index";
import type { DiningSession, DiningSessionMember, GroupDecisionMember, MealPreferenceState, Venue } from "./group";

const FIXTURE_TIME = "2026-09-12T12:00:00.000Z";
const EMPTY_MEAL_PREFERENCES: MealPreferenceState = {
  desiredTags: [],
  avoidedTags: [],
  excludedIngredients: [],
  excludedProteinTypes: [],
};

function tasteFeatures(traits: Partial<TasteFeatureVector> = {}): DishFeatures {
  return {
    ...Object.fromEntries(
      TASTE_DIMENSIONS.map((dimension) => [dimension, traits[dimension] ?? 0]),
    ) as TasteFeatureVector,
    cuisines: ["Fixture"],
    majorIngredients: [],
    proteinTypes: [],
    carbohydrateTypes: [],
    cookingMethods: [],
  };
}

function dish(
  id: string,
  embedding: number[],
  traits: Partial<TasteFeatureVector> = {},
): Dish {
  return {
    id,
    name: id,
    description: `${id} fixture dish`,
    cuisine: "Fixture",
    ingredients: [],
    embedding,
    features: tasteFeatures(traits),
  };
}

function venue(
  id: string,
  dishes: Dish[],
  freshness: Venue["menuFreshness"] = "fresh",
): Venue {
  const menuId = `menu-${id}`;
  return {
    id,
    name: id,
    location: { latitude: 40.443, longitude: -79.943 },
    menuItems: dishes.map((candidate, menuOrder): MenuItem => ({
      id: `item-${candidate.id}`,
      menuId,
      menuOrder,
      price: 10,
      dish: candidate,
    })),
    menuFreshness: freshness,
    menuUpdatedAt: freshness === "stale" ? "2026-09-01T12:00:00.000Z" : FIXTURE_TIME,
  };
}

function profile(userId: string, semanticVector: number[]): TasteProfile {
  const attributes = Object.fromEntries(TASTE_DIMENSIONS.map((dimension) => [dimension, 0])) as TasteFeatureVector;
  return {
    id: `profile-${userId}`,
    userId,
    semanticVector,
    attributePreferences: attributes,
    cuisinePreferences: {},
    cookingMethodPreferences: {},
    favoriteCuisines: [],
    strongestPositiveFlavors: [],
    strongestNegativeFlavors: [],
    favoriteTextures: [],
    preferredCookingStyles: [],
    representativeDishIds: [],
    ratingCount: 12,
    confidence: "taking shape",
    updatedAt: FIXTURE_TIME,
  };
}

function member(
  sessionId: string,
  userId: string,
  mealPreferenceState: MealPreferenceState = EMPTY_MEAL_PREFERENCES,
): DiningSessionMember {
  return {
    sessionId,
    userId,
    displayName: userId,
    status: "responded",
    mealPreferenceState: { ...mealPreferenceState, desiredTags: [...mealPreferenceState.desiredTags], avoidedTags: [...mealPreferenceState.avoidedTags], excludedIngredients: [...mealPreferenceState.excludedIngredients], excludedProteinTypes: [...mealPreferenceState.excludedProteinTypes] },
    respondedAt: FIXTURE_TIME,
  };
}

export interface GroupGoldenFixture {
  id: "clear-winner" | "misery-floor" | "near-tie" | "stale-menu" | "preference-flip";
  session: DiningSession;
  venues: Venue[];
  members: GroupDecisionMember[];
  expected: {
    winnerVenueId: string;
    failingVenueIds?: string[];
    staleVenueIds?: string[];
    winnerWithoutPreferenceId?: string;
    winnerWithPreferenceId?: string;
  };
}

function fixture(
  id: GroupGoldenFixture["id"],
  venues: Venue[],
  members: GroupDecisionMember[],
  expected: GroupGoldenFixture["expected"],
): GroupGoldenFixture {
  return {
    id,
    session: {
      id: `session-${id}`,
      title: id,
      createdByUserId: members[0]?.member.userId ?? "fixture-owner",
      candidateVenueIds: venues.map((candidate) => candidate.id),
      status: "open",
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    venues,
    members,
    expected,
  };
}

function decisionMember(
  sessionId: string,
  userId: string,
  semanticVector: number[],
  mealPreferenceState?: MealPreferenceState,
): GroupDecisionMember {
  return { member: member(sessionId, userId, mealPreferenceState), profile: profile(userId, semanticVector) };
}

export const GROUP_GOLDEN_FIXTURES: GroupGoldenFixture[] = [
  fixture(
    "clear-winner",
    [
      venue("market-district", [
        dish("market-alex", [1, 0], { umami: 0.8 }),
        dish("market-blair", [0, 1], { fresh: 0.8 }),
      ]),
      venue("fallback-cafe", [dish("fallback", [1, 0], { rich: 0.8 })]),
    ],
    [
      decisionMember("session-clear-winner", "alex", [1, 0]),
      decisionMember("session-clear-winner", "blair", [0, 1]),
    ],
    { winnerVenueId: "market-district" },
  ),
  fixture(
    "misery-floor",
    [
      venue("balanced-bowls", [
        dish("balanced-alex", [1, 0], { umami: 0.8 }),
        dish("balanced-blair", [0, 1], { fresh: 0.8 }),
      ]),
      venue("one-member-miss", [
        dish("one-member-miss-alex", [1, 0]),
        dish("one-member-miss-blair", [0, -1]),
      ]),
    ],
    [
      decisionMember("session-misery-floor", "alex", [1, 0]),
      decisionMember("session-misery-floor", "blair", [0, 1]),
    ],
    { winnerVenueId: "balanced-bowls", failingVenueIds: ["one-member-miss"] },
  ),
  fixture(
    "near-tie",
    [
      venue("noodle-house", [dish("noodle-alex", [1, 0]), dish("noodle-blair", [0, 1])]),
      venue("rice-kitchen", [dish("rice-alex", [1, 0]), dish("rice-blair", [0, 1])]),
    ],
    [
      decisionMember("session-near-tie", "alex", [1, 0]),
      decisionMember("session-near-tie", "blair", [0, 1]),
    ],
    { winnerVenueId: "noodle-house" },
  ),
  fixture(
    "stale-menu",
    [
      venue("fresh-choice", [dish("fresh-dish", [1, 0])]),
      venue("stale-choice", [dish("stale-dish", [1, 0])], "stale"),
    ],
    [decisionMember("session-stale-menu", "alex", [1, 0])],
    { winnerVenueId: "fresh-choice", staleVenueIds: ["stale-choice"] },
  ),
  fixture(
    "preference-flip",
    [
      venue("spice-route", [dish("spice-route-dish", [0.8, 0.6], { spicy: 1 })]),
      venue("comfort-cafe", [dish("comfort-cafe-dish", [1, 0], { creamy: 0.8, rich: 0.8 })]),
    ],
    [
      decisionMember("session-preference-flip", "alex", [1, 0], {
        ...EMPTY_MEAL_PREFERENCES,
        desiredTags: ["spicy"],
      }),
    ],
    {
      winnerVenueId: "spice-route",
      winnerWithoutPreferenceId: "comfort-cafe",
      winnerWithPreferenceId: "spice-route",
    },
  ),
];
