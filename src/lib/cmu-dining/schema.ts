import { z } from "zod";

const optionalText = z.string().nullable();

export const CmuDiningSpecialSchema = z.union([
  z.object({ name: z.string(), description: z.string() }),
  z.object({ title: z.string(), description: z.string() }),
]);

export const CmuDiningTimeSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

/**
 * Current api.cmueats.com/v2 response shape. Nullable fields mirror the
 * upstream source even when today's feed happens to populate every value.
 */
export const CmuDiningLocationSchema = z.object({
  id: z.string().min(1),
  name: optionalText,
  shortDescription: optionalText,
  description: z.string(),
  url: z.string(),
  menu: optionalText,
  location: z.string(),
  coordinateLat: z.number().finite().nullable(),
  coordinateLng: z.number().finite().nullable(),
  acceptsOnlineOrders: z.boolean(),
  times: z.array(CmuDiningTimeSchema),
  conceptId: z.union([z.string(), z.number().int().transform(String)]).nullable(),
  ratingsAvg: z.number().finite().nullable().optional(),
  ratingsCount: z.number().int().nonnegative().optional(),
  todaysSoups: z.array(CmuDiningSpecialSchema),
  todaysSpecials: z.array(CmuDiningSpecialSchema),
  reportCount: z.number().int().nonnegative().optional(),
});

export const CmuDiningLocationsSchema = z.array(CmuDiningLocationSchema).min(1);

export const CmuDiningLastGoodFixtureSchema = z.object({
  capturedAt: z.iso.datetime(),
  locations: CmuDiningLocationsSchema,
});

export type CmuDiningLocation = z.infer<typeof CmuDiningLocationSchema>;
export type CmuDiningSpecial = z.infer<typeof CmuDiningSpecialSchema>;
