import { z } from "zod";

const normalized = z.number().min(0).max(1);

export const extractedDishSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  price: z.number().nonnegative().nullable(),
  category: z.string().trim().min(1).max(80),
  cuisine: z.string().trim().max(80),
  ingredients: z.array(z.string().trim().min(1)).max(20),
  sweet: normalized,
  salty: normalized,
  sour: normalized,
  bitter: normalized,
  umami: normalized,
  spicy: normalized,
  rich: normalized,
  fresh: normalized,
  crispy: normalized,
  creamy: normalized,
  chewy: normalized,
  smoky: normalized,
  proteinTypes: z.array(z.string().trim()).max(8),
  carbohydrateTypes: z.array(z.string().trim()).max(8),
  cookingMethods: z.array(z.string().trim()).max(8),
  confidence: z.number().min(0).max(1),
  unknownFields: z.array(z.string().trim()).max(20),
});

export const extractedMenuModelSchema = z.object({
  restaurantName: z.string().trim().max(120).nullable(),
  currency: z.string().trim().length(3),
  dishes: z.array(extractedDishSchema).max(80),
});

export type ExtractedDishInput = z.infer<typeof extractedDishSchema>;
export type ExtractedMenuModel = z.infer<typeof extractedMenuModelSchema>;
