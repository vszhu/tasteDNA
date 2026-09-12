import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { buildTasteProfile } from "./profile";
import { SupabaseTasteRepository } from "./repository";
import { SEED_DISHES } from "./seed-foods";

const USER_ID = "90000000-0000-0000-0000-000000000001";

function asClient(from: ReturnType<typeof vi.fn>) {
  return { from } as unknown as SupabaseClient;
}

describe("Supabase TasteDNA repository", () => {
  it("loads the signed-in user's ratings, dish snapshots, and full profile", async () => {
    const rating = {
      id: "database-rating-id",
      user_id: USER_ID,
      client_id: "feedback-custom-dish",
      client_dish_id: "custom-dish",
      dish_snapshot: { ...SEED_DISHES[0], id: "custom-dish" },
      value: 5,
      source: "feedback",
      created_at: "2026-09-12T00:00:00.000Z",
    };
    const profile = buildTasteProfile(USER_ID, [{
      id: rating.client_id,
      userId: USER_ID,
      dishId: rating.client_dish_id,
      value: 5,
      source: "feedback",
      createdAt: rating.created_at,
    }], [{ ...SEED_DISHES[0], id: "custom-dish" }]);
    const ratingsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [rating], error: null }),
    };
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { profile_state: profile }, error: null }),
    };
    const from = vi.fn((table: string) => table === "ratings" ? ratingsQuery : profileQuery);

    const loaded = await new SupabaseTasteRepository(asClient(from)).load(USER_ID);

    expect(loaded.ratings[0]).toMatchObject({
      id: "feedback-custom-dish",
      userId: USER_ID,
      dishId: "custom-dish",
      value: 5,
    });
    expect(loaded.customDishes[0].id).toBe("custom-dish");
    expect(loaded.profile).toEqual(profile);
  });

  it("upserts account ratings and the derived profile without requiring dish UUIDs", async () => {
    const existingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const ratingUpsert = vi.fn().mockResolvedValue({ error: null });
    const profileUpsert = vi.fn().mockResolvedValue({ error: null });
    let ratingsCalls = 0;
    const from = vi.fn((table: string) => {
      if (table === "taste_profiles") return { upsert: profileUpsert };
      ratingsCalls += 1;
      return ratingsCalls === 1 ? existingQuery : { upsert: ratingUpsert };
    });
    const rating = {
      id: "rating-seed-dish",
      userId: USER_ID,
      dishId: SEED_DISHES[0].id,
      value: 5 as const,
      source: "onboarding" as const,
      createdAt: "2026-09-12T00:00:00.000Z",
    };
    const profile = buildTasteProfile(USER_ID, [rating], SEED_DISHES);

    await new SupabaseTasteRepository(asClient(from)).save(USER_ID, {
      ratings: [rating],
      customDishes: [],
      profile,
    });

    expect(ratingUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: USER_ID,
        dish_id: null,
        client_id: rating.id,
        client_dish_id: rating.dishId,
      }),
    ], { onConflict: "user_id,client_dish_id" });
    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, profile_state: profile, state_version: 1 }),
      { onConflict: "user_id" },
    );
  });
});
