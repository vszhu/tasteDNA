import { describe, expect, it, vi } from "vitest";
import type { EmbeddingProvider } from "@/lib/embeddings/types";
import { SAMPLE_MENU_MODEL } from "./sample";
import { parsePastedMenu, processExtractedMenuWithEmbeddings } from "./process";

describe("menu processing", () => {
  it("creates all missing dish embeddings in one provider batch and reuses the cache", async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map((_, index) => [index + 1, 0, 0]));
    const provider: EmbeddingProvider = { name: "test-provider", embed };
    const cache = new Map<string, number[]>();
    const extracted = { ...SAMPLE_MENU_MODEL, dishes: SAMPLE_MENU_MODEL.dishes.slice(0, 3) };

    const first = await processExtractedMenuWithEmbeddings(extracted, "image", false, undefined, {
      embeddingProvider: provider,
      embeddingCache: cache,
    });
    const second = await processExtractedMenuWithEmbeddings(extracted, "image", false, undefined, {
      embeddingProvider: provider,
      embeddingCache: cache,
    });

    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.calls[0][0]).toHaveLength(3);
    expect(first.items.map((item) => item.dish.embedding)).toEqual(second.items.map((item) => item.dish.embedding));
    expect(first.items[0].dish.category).toBe("Noodles");
  });

  it("falls back to compatible deterministic embeddings when a provider batch fails", async () => {
    const provider: EmbeddingProvider = {
      name: "failing-provider",
      embed: vi.fn(async () => { throw new Error("unavailable"); }),
    };
    const extracted = { ...SAMPLE_MENU_MODEL, dishes: SAMPLE_MENU_MODEL.dishes.slice(0, 2) };

    const result = await processExtractedMenuWithEmbeddings(extracted, "image", false, undefined, {
      embeddingProvider: provider,
      embeddingCache: new Map(),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.dish.embedding.length === 64)).toBe(true);
  });

  it("preserves recognized section headings for pasted menus", () => {
    const result = parsePastedMenu("Starters\nCrispy Tofu — chile, lime  12\nMains\nMiso Ramen — egg, noodles  19");

    expect(result.dishes.map((dish) => dish.category)).toEqual(["Starters", "Mains"]);
  });
});
