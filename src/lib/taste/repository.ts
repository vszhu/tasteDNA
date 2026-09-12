import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dish, Rating, TasteProfile } from "@/types";
import { dishSchema, tasteProfileSchema } from "./persistence-schema";

export interface PersistedTasteState {
  ratings: Rating[];
  customDishes: Dish[];
  profile: TasteProfile | null;
}

export interface TasteRepository {
  load(userId: string): Promise<PersistedTasteState>;
  save(userId: string, state: PersistedTasteState): Promise<void>;
}

interface RatingRow {
  id: string;
  user_id: string;
  client_id: string;
  client_dish_id: string;
  dish_snapshot: unknown;
  value: number;
  source: Rating["source"];
  created_at: string;
}

function checkedRating(row: RatingRow): Rating {
  if (!Number.isInteger(row.value) || row.value < 1 || row.value > 5) {
    throw new Error("The saved rating data is invalid.");
  }
  if (row.source !== "onboarding" && row.source !== "feedback") {
    throw new Error("The saved rating source is invalid.");
  }
  return {
    id: row.client_id,
    userId: row.user_id,
    dishId: row.client_dish_id,
    value: row.value as Rating["value"],
    source: row.source,
    createdAt: row.created_at,
  };
}

export class SupabaseTasteRepository implements TasteRepository {
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(private readonly client: SupabaseClient) {}

  async load(userId: string): Promise<PersistedTasteState> {
    const [ratingsResult, profileResult] = await Promise.all([
      this.client
        .from("ratings")
        .select("id,user_id,client_id,client_dish_id,dish_snapshot,value,source,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      this.client
        .from("taste_profiles")
        .select("profile_state")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (ratingsResult.error || profileResult.error) {
      throw new Error("Unable to load the signed-in TasteDNA.");
    }

    const rows = (ratingsResult.data ?? []) as RatingRow[];
    const ratings = rows.map(checkedRating);
    if (ratings.some((rating) => rating.userId !== userId)) {
      throw new Error("The saved rating owner is invalid.");
    }
    const customDishes = new Map<string, Dish>();
    for (const row of rows) {
      if (row.dish_snapshot === null) continue;
      const parsed = dishSchema.safeParse(row.dish_snapshot);
      if (!parsed.success) throw new Error("A saved dish snapshot is invalid.");
      if (parsed.data.id !== row.client_dish_id) {
        throw new Error("A saved dish snapshot does not match its rating.");
      }
      customDishes.set(parsed.data.id, parsed.data);
    }

    const parsedProfile = tasteProfileSchema.safeParse(profileResult.data?.profile_state);
    if (parsedProfile.success && parsedProfile.data.userId !== userId) {
      throw new Error("The saved profile owner is invalid.");
    }
    return {
      ratings,
      customDishes: [...customDishes.values()],
      profile: parsedProfile.success ? parsedProfile.data : null,
    };
  }

  save(userId: string, state: PersistedTasteState): Promise<void> {
    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(() => this.performSave(userId, state));
    return this.saveQueue;
  }

  private async performSave(userId: string, state: PersistedTasteState): Promise<void> {
    const dishById = new Map(state.customDishes.map((dish) => [dish.id, dish]));
    const rows = state.ratings.map((rating) => ({
      user_id: userId,
      dish_id: null,
      client_id: rating.id,
      client_dish_id: rating.dishId,
      dish_snapshot: dishById.get(rating.dishId) ?? null,
      value: rating.value,
      source: rating.source,
      created_at: rating.createdAt,
    }));

    const existingResult = await this.client
      .from("ratings")
      .select("id,client_dish_id")
      .eq("user_id", userId);
    if (existingResult.error) throw new Error("Unable to save the signed-in TasteDNA.");

    if (rows.length > 0) {
      const upsertResult = await this.client
        .from("ratings")
        .upsert(rows, { onConflict: "user_id,client_dish_id" });
      if (upsertResult.error) throw new Error("Unable to save the signed-in TasteDNA.");
    }

    const retainedDishIds = new Set(rows.map((row) => row.client_dish_id));
    const staleIds = (existingResult.data ?? [])
      .filter((row) => !retainedDishIds.has(row.client_dish_id as string))
      .map((row) => row.id as string);
    if (staleIds.length > 0) {
      const deleteResult = await this.client
        .from("ratings")
        .delete()
        .eq("user_id", userId)
        .in("id", staleIds);
      if (deleteResult.error) throw new Error("Unable to save the signed-in TasteDNA.");
    }

    if (state.profile) {
      const profileResult = await this.client.from("taste_profiles").upsert(
        {
          user_id: userId,
          semantic_vector: null,
          attribute_preferences: state.profile.attributePreferences,
          cuisine_preferences: state.profile.cuisinePreferences,
          cooking_method_preferences: state.profile.cookingMethodPreferences,
          rating_count: state.profile.ratingCount,
          confidence: state.profile.confidence,
          updated_at: state.profile.updatedAt,
          profile_state: state.profile,
          state_version: 1,
        },
        { onConflict: "user_id" },
      );
      if (profileResult.error) throw new Error("Unable to save the signed-in TasteDNA.");
    }
  }
}
