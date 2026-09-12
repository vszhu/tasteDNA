import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseSharedMenuRepository } from "./shared-repository";
import type { SharedMenuIngestionInput } from "./shared-types";
import { CMU_ABP_MENU_URL } from "./cmu-ingredient-details";

describe("shared menu repository transaction", () => {
  it("surfaces an RPC failure without reporting a partial write", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "rolled back" } });
    const client = { rpc } as unknown as SupabaseClient;
    const repository = new SupabaseSharedMenuRepository(client);

    await expect(repository.ingest({
      venueId: "20000000-0000-0000-0000-000000000001",
      uploadedBy: "90000000-0000-0000-0000-000000000001",
      restaurantName: "Test",
      sourceType: "text",
      sourceProvider: "test",
      sourceUri: null,
      sourceMetadata: {},
      currency: "USD",
      contentHash: "a".repeat(64),
      observedAt: "2026-09-12T00:00:00.000Z",
      items: [],
    } satisfies SharedMenuIngestionInput)).rejects.toThrow("transaction");
  });
});

describe("shared menu ingredient source read integration", () => {
  it("supplements persisted name-only import rows from their provenance while retaining menu order", async () => {
    const id = "20000000-0000-4000-8000-000000000001";
    const row = {
      id, venue_id: id, version: 1, observed_at: "2026-09-12T00:00:00Z", valid_from: "2026-09-12T00:00:00Z", valid_until: null,
      source_provider: "cmu-dining-dataset-v2", source_uri: CMU_ABP_MENU_URL,
      source_metadata: { datasetId: 113, datasetGeneratedDate: "2026-09-11", dishDetailsInferredFromNames: true },
      menu_items: [2, 1].map((order) => ({
        id, menu_id: id, menu_order: order, price: 8.25, category: "Sandwiches",
        dishes: {
          id, name: "Extra Bacon BLT", description: "Inferred", cuisine: "American", ingredients: [], ranking_embedding: [1, 0],
          dish_features: {
            sweet: 0, salty: 1, sour: 0, bitter: 0, umami: 1, spicy: 0, rich: 1, fresh: 0, crispy: 1, creamy: 0, chewy: 0, smoky: 1,
            cuisines: ["American"], major_ingredients: [], protein_types: ["pork"], carbohydrate_types: [], cooking_methods: [],
            confidence: 0.5, unknown_fields: ["ingredients", "description"],
          },
        },
      })),
    };
    const query = {
      select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
    const menus = await new SupabaseSharedMenuRepository(client).listNewestValidForVenues([id], new Date("2026-09-12T12:00:00Z"));
    expect(query.select.mock.calls[0][0]).toMatch(/source_provider/);
    expect(query.select.mock.calls[0][0]).toMatch(/source_metadata/);
    expect(menus.get(id)?.items.map((item) => item.menuOrder)).toEqual([1, 2]);
    expect(menus.get(id)?.items[0].dish.ingredientSource?.kind).toBe("published-menu");
    expect(menus.get(id)?.items[0].dish.features.unknownFields).toEqual([]);
    expect(row.menu_items.map((item) => item.menu_order)).toEqual([2, 1]);
  });
});
