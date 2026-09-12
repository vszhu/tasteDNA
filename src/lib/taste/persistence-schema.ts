import { z } from "zod";
import { TASTE_DIMENSIONS } from "@/types";

const tasteVectorSchema = z.object(
  Object.fromEntries(TASTE_DIMENSIONS.map((dimension) => [dimension, z.number()])) as Record<
    (typeof TASTE_DIMENSIONS)[number],
    z.ZodNumber
  >,
);

export const dishSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  category: z.string().optional(),
  cuisine: z.string(),
  ingredients: z.array(z.string()),
  features: tasteVectorSchema.extend({
    cuisines: z.array(z.string()),
    majorIngredients: z.array(z.string()),
    proteinTypes: z.array(z.string()),
    carbohydrateTypes: z.array(z.string()),
    cookingMethods: z.array(z.string()),
    confidence: z.number().optional(),
    unknownFields: z.array(z.string()).optional(),
  }),
  embedding: z.array(z.number()),
  imageHint: z.string().optional(),
});

export const ratingSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  dishId: z.string().min(1),
  value: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  source: z.enum(["onboarding", "feedback"]),
  createdAt: z.string(),
});

export const tasteProfileSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  semanticVector: z.array(z.number()),
  attributePreferences: tasteVectorSchema,
  cuisinePreferences: z.record(z.string(), z.number()),
  cookingMethodPreferences: z.record(z.string(), z.number()),
  favoriteCuisines: z.array(z.string()),
  strongestPositiveFlavors: z.array(z.enum(TASTE_DIMENSIONS)),
  strongestNegativeFlavors: z.array(z.enum(TASTE_DIMENSIONS)),
  favoriteTextures: z.array(z.enum(TASTE_DIMENSIONS)),
  preferredCookingStyles: z.array(z.string()),
  representativeDishIds: z.array(z.string()),
  ratingCount: z.number().int().nonnegative(),
  confidence: z.enum(["early read", "taking shape", "well defined"]),
  updatedAt: z.string(),
});
