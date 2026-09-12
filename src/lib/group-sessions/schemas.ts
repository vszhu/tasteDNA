import { z } from "zod";
import { MEAL_PREFERENCE_TAGS } from "@/types/group";

const uniqueStrings = (values: string[]) => new Set(values).size === values.length;

const normalizedStringList = z
  .array(z.string().trim().min(1).max(100))
  .max(50)
  .refine(uniqueStrings, "Values must be unique.");

export const mealPreferenceStateSchema = z
  .object({
    desiredTags: z.array(z.enum(MEAL_PREFERENCE_TAGS)).max(MEAL_PREFERENCE_TAGS.length),
    avoidedTags: z.array(z.enum(MEAL_PREFERENCE_TAGS)).max(MEAL_PREFERENCE_TAGS.length),
    excludedIngredients: normalizedStringList,
    excludedProteinTypes: normalizedStringList,
    maxPrice: z.number().finite().positive().max(1000).optional(),
  })
  .strict()
  .refine((state) => uniqueStrings(state.desiredTags), "Desired tags must be unique.")
  .refine((state) => uniqueStrings(state.avoidedTags), "Avoided tags must be unique.")
  .refine(
    (state) => state.desiredTags.every((tag) => !state.avoidedTags.includes(tag)),
    "A tag cannot be both desired and avoided.",
  );

const uniqueUuidList = (minimum: number, maximum: number) =>
  z
    .array(z.string().uuid())
    .min(minimum)
    .max(maximum)
    .refine(uniqueStrings, "IDs must be unique.");

export const createGroupSessionSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    scheduledFor: z.string().datetime({ offset: true }).optional(),
    inviteeUserIds: uniqueUuidList(0, 20).default([]),
    candidateVenueIds: uniqueUuidList(3, 5),
  })
  .strict();

export const inviteSessionMemberSchema = z
  .object({ userId: z.string().uuid() })
  .strict();

export const invitationResponseSchema = z
  .object({ action: z.enum(["accept", "decline"]) })
  .strict();

export const replaceCandidatesSchema = z
  .object({ venueIds: uniqueUuidList(3, 5) })
  .strict();

export const sessionIdSchema = z.string().uuid();

const menuReviewVenueSchema = z.object({
  venueId: z.string().uuid(),
  venueName: z.string().trim().min(1).max(300),
  totalDishes: z.number().int().min(0).max(10000),
  missingIngredientDishes: z.number().int().min(0).max(10000),
}).strict().refine((venue) => venue.missingIngredientDishes <= venue.totalDishes);

/** A narrow allowlist prevents private account details reaching the shared recovery UI. */
export const groupMenuReviewSchema = z.object({
  kind: z.literal("menu-review-required"),
  venues: z.array(menuReviewVenueSchema).min(1).max(5)
    .refine((venues) => uniqueStrings(venues.map((venue) => venue.venueId))),
  checkedMembers: z.number().int().min(1).max(1000),
  totalMembers: z.number().int().min(1).max(1000),
}).strict().refine((review) => review.checkedMembers <= review.totalMembers);
