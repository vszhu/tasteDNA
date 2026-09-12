import type { Dish, MenuItem, TasteProfile } from "./index";

export const MEAL_PREFERENCE_TAGS = [
  "spicy",
  "light",
  "comforting",
  "filling",
  "cheap",
  "quick",
] as const;

export type MealPreferenceTag = (typeof MEAL_PREFERENCE_TAGS)[number];
export type VenueMenuFreshness = "fresh" | "stale" | "unknown";
export type DiningSessionStatus = "draft" | "open" | "revealed" | "cancelled";
export type DiningSessionMemberStatus = "invited" | "joined" | "declined" | "responded";
export type FriendshipStatus = "pending" | "accepted" | "declined";

export interface VenueLocation {
  label?: string;
  latitude: number;
  longitude: number;
}

/** A venue with the concrete dishes the group engine may score. */
export interface Venue {
  id: string;
  name: string;
  description?: string;
  location: VenueLocation;
  menuItems: MenuItem[];
  menuFreshness: VenueMenuFreshness;
  menuUpdatedAt?: string;
  acceptsOnlineOrders?: boolean;
}

/** A lightweight venue shape for session lists and recommendation output. */
export interface VenueSummary {
  id: string;
  name: string;
  description?: string;
  location: VenueLocation;
  menuFreshness: VenueMenuFreshness;
}

/** Temporary preferences for one meal. They must never mutate a TasteProfile. */
export interface MealPreferenceState {
  desiredTags: MealPreferenceTag[];
  avoidedTags: MealPreferenceTag[];
  excludedIngredients: string[];
  excludedProteinTypes: string[];
  maxPrice?: number;
}

export interface DiningSession {
  id: string;
  title: string;
  createdByUserId: string;
  candidateVenueIds: string[];
  status: DiningSessionStatus;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiningSessionMember {
  sessionId: string;
  userId: string;
  displayName: string;
  status: DiningSessionMemberStatus;
  mealPreferenceState: MealPreferenceState;
  respondedAt?: string;
}

export interface FriendshipSummary {
  friendshipId: string;
  userId: string;
  friendUserId: string;
  friendDisplayName: string;
  status: FriendshipStatus;
}

export interface DishUtilityFactor {
  label: string;
  contribution: number;
  kind: "persistent" | "meal-context" | "constraint";
}

/** A reproducible per-member evaluation of one concrete dish. */
export interface DishUtility {
  memberId: string;
  venueId: string;
  dish: Dish;
  menuItemId: string;
  baseScore: number;
  contextAdjustment: number;
  utility: number;
  excluded: boolean;
  exclusionReason?: string;
  factors: DishUtilityFactor[];
}

/** A member's utility for a venue, derived from actual available dishes. */
export interface RestaurantUtility {
  memberId: string;
  venue: VenueSummary;
  dishUtilities: DishUtility[];
  bestDishUtility: number;
  topThreeMeanUtility: number;
  utility: number;
}

/** A fairness-aware aggregate for one candidate venue across all group members. */
export interface VenueGroupScore {
  venue: VenueSummary;
  restaurantUtilities: RestaurantUtility[];
  groupScore: number;
  groupMeanUtility: number;
  worstMemberUtility: number;
  clearsMiseryFloor: boolean;
}

export interface MemberDishAssignment {
  memberId: string;
  dishUtility: DishUtility;
}

export interface GroupExplanationFact {
  kind: "winner-advantage" | "worst-member-protection" | "misery-floor" | "compromise";
  value: number;
  label: string;
}

export interface DecisionConfidence {
  level: "high" | "medium" | "low";
  winnerMargin: number;
  isFragile: boolean;
}

export interface PreferenceQuestion {
  id: string;
  memberId: string;
  tag: MealPreferenceTag;
  prompt: string;
}

export interface GroupRecommendation {
  sessionId: string;
  winner: VenueSummary;
  groupScore: number;
  groupMeanUtility: number;
  worstMemberUtility: number;
  miseryFloor: number;
  compromiseRequired: boolean;
  assignments: MemberDishAssignment[];
  restaurantUtilities: RestaurantUtility[];
  venueScores: VenueGroupScore[];
  runnerUp?: VenueSummary;
  explanationFacts: GroupExplanationFact[];
  decisionConfidence?: DecisionConfidence;
  preferenceQuestion?: PreferenceQuestion;
}

/**
 * Domain-only input supplied by the backend after it resolves each member's
 * private standing profile. Profiles are intentionally not returned in results.
 */
export interface GroupDecisionMember {
  member: DiningSessionMember;
  profile: TasteProfile;
}
