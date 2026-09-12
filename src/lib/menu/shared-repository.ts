import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TASTE_DIMENSIONS, type DishFeatures, type MenuItem } from "@/types";
import { selectNewestValidMenus } from "./shared-selection";
import type {
  SharedMenuIngestionInput,
  SharedMenuIngestionResult,
  SharedMenuRepository,
  SharedVenueMenu,
} from "./shared-types";

const featureSchema = z.object({
  sweet: z.number(),
  salty: z.number(),
  sour: z.number(),
  bitter: z.number(),
  umami: z.number(),
  spicy: z.number(),
  rich: z.number(),
  fresh: z.number(),
  crispy: z.number(),
  creamy: z.number(),
  chewy: z.number(),
  smoky: z.number(),
  cuisines: z.array(z.string()),
  major_ingredients: z.array(z.string()),
  protein_types: z.array(z.string()),
  carbohydrate_types: z.array(z.string()),
  cooking_methods: z.array(z.string()),
  confidence: z.number().nullable(),
  unknown_fields: z.array(z.string()),
});

const relatedFeatureSchema = z.union([
  featureSchema,
  z.array(featureSchema).length(1).transform(([feature]) => feature),
]);

const dishRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  cuisine: z.string(),
  ingredients: z.array(z.string()),
  ranking_embedding: z.array(z.number()),
  dish_features: relatedFeatureSchema,
});

const relatedDishSchema = z.union([
  dishRowSchema,
  z.array(dishRowSchema).length(1).transform(([dish]) => dish),
]);

const menuRowSchema = z.object({
  id: z.string().uuid(),
  venue_id: z.string().uuid(),
  version: z.number().int().positive(),
  observed_at: z.string(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  menu_items: z.array(z.object({
    id: z.string().uuid(),
    menu_id: z.string().uuid(),
    menu_order: z.number().int().nonnegative(),
    price: z.number().nullable(),
    category: z.string().nullable(),
    dishes: relatedDishSchema,
  })),
});

const ingestionResultSchema = z.object({
  menuId: z.string().uuid(),
  version: z.number().int().positive(),
  created: z.boolean(),
});

const SHARED_MENU_SELECT = `
  id,
  venue_id,
  version,
  observed_at,
  valid_from,
  valid_until,
  menu_items (
    id,
    menu_id,
    menu_order,
    price,
    category,
    dishes (
      id,
      name,
      description,
      cuisine,
      ingredients,
      ranking_embedding,
      dish_features (
        sweet,
        salty,
        sour,
        bitter,
        umami,
        spicy,
        rich,
        fresh,
        crispy,
        creamy,
        chewy,
        smoky,
        cuisines,
        major_ingredients,
        protein_types,
        carbohydrate_types,
        cooking_methods,
        confidence,
        unknown_fields
      )
    )
  )
`;

function rpcInput(input: SharedMenuIngestionInput) {
  return {
    p_venue_id: input.venueId,
    p_uploaded_by: input.uploadedBy,
    p_restaurant_name: input.restaurantName,
    p_source_type: input.sourceType,
    p_source_provider: input.sourceProvider,
    p_source_uri: input.sourceUri,
    p_source_metadata: input.sourceMetadata,
    p_currency: input.currency,
    p_content_hash: input.contentHash,
    p_observed_at: input.observedAt,
    p_items: input.items,
  };
}

function menuItems(row: z.infer<typeof menuRowSchema>): MenuItem[] {
  return row.menu_items
    .sort((left, right) => left.menu_order - right.menu_order)
    .map((item) => {
      const dish = item.dishes;
      const storedFeatures = dish.dish_features;
      const numericFeatures = Object.fromEntries(
        TASTE_DIMENSIONS.map((dimension) => [dimension, storedFeatures[dimension]]),
      ) as Pick<DishFeatures, (typeof TASTE_DIMENSIONS)[number]>;

      return {
        id: item.id,
        menuId: item.menu_id,
        menuOrder: item.menu_order,
        price: item.price,
        dish: {
          id: dish.id,
          name: dish.name,
          description: dish.description,
          ...(item.category ? { category: item.category } : {}),
          cuisine: dish.cuisine,
          ingredients: dish.ingredients,
          embedding: dish.ranking_embedding,
          features: {
            ...numericFeatures,
            cuisines: storedFeatures.cuisines,
            majorIngredients: storedFeatures.major_ingredients,
            proteinTypes: storedFeatures.protein_types,
            carbohydrateTypes: storedFeatures.carbohydrate_types,
            cookingMethods: storedFeatures.cooking_methods,
            ...(storedFeatures.confidence === null ? {} : { confidence: storedFeatures.confidence }),
            unknownFields: storedFeatures.unknown_fields,
          },
        },
      };
    });
}

export class SupabaseSharedMenuRepository implements SharedMenuRepository {
  constructor(private readonly client: SupabaseClient) {}

  async ingest(input: SharedMenuIngestionInput): Promise<SharedMenuIngestionResult> {
    const { data, error } = await this.client.rpc("ingest_shared_menu", rpcInput(input));
    // The message stays generic for API callers; the PostgREST error rides
    // along as `cause` so operators and scripts can see what actually failed.
    if (error) throw new Error("Unable to persist the shared menu transaction.", { cause: error });
    const parsed = ingestionResultSchema.safeParse(data);
    if (!parsed.success) throw new Error("The shared menu transaction returned an invalid result.");
    return parsed.data;
  }

  async listNewestValidForVenues(venueIds: string[], now = new Date()) {
    if (venueIds.length === 0) return new Map<string, SharedVenueMenu>();
    const { data, error } = await this.client
      .from("menus")
      .select(SHARED_MENU_SELECT)
      .in("venue_id", venueIds)
      .not("version", "is", null)
      .not("valid_from", "is", null)
      .order("version", { ascending: false });
    if (error) throw new Error("Unable to load shared venue menus.");

    const rows = z.array(menuRowSchema).parse(data ?? []);
    const candidates = rows.map((row) => ({
      venueId: row.venue_id,
      version: row.version,
      observedAt: row.observed_at,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      value: row,
    }));
    const selected = selectNewestValidMenus(candidates, now);
    return new Map([...selected.entries()].map(([venueId, selection]) => [venueId, {
      menuId: selection.value.id,
      venueId,
      version: selection.version,
      observedAt: selection.observedAt,
      validFrom: selection.validFrom,
      validUntil: selection.validUntil,
      freshness: selection.freshness,
      items: menuItems(selection.value),
    }]));
  }
}
