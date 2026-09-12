import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseSharedMenuRepository } from "./shared-repository";
import type { SharedMenuIngestionInput } from "./shared-types";

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
