import { describe, expect, it } from "vitest";
import { processExtractedMenu } from "./process";
import { SAMPLE_MENU_MODEL } from "./sample";
import { buildSharedMenuIngestion } from "./shared-normalize";

const metadata = {
  venueId: "20000000-0000-0000-0000-000000000001",
  uploadedBy: "90000000-0000-0000-0000-000000000001",
  sourceType: "text" as const,
  sourceProvider: "test",
  sourceUri: null,
  sourceMetadata: { rawImageStored: false },
  observedAt: "2026-09-12T12:00:00.000Z",
};

describe("shared menu normalization", () => {
  it("produces the same content identity for identical uploads", () => {
    const first = processExtractedMenu(SAMPLE_MENU_MODEL, "text", false);
    const second = processExtractedMenu(SAMPLE_MENU_MODEL, "text", false);

    expect(buildSharedMenuIngestion(first, metadata).contentHash)
      .toBe(buildSharedMenuIngestion(second, metadata).contentHash);
  });

  it("changes the identity when normalized menu content changes", () => {
    const original = processExtractedMenu(SAMPLE_MENU_MODEL, "text", false);
    const changed = {
      ...original,
      items: original.items.map((item, index) => index === 0 ? { ...item, price: 999 } : item),
    };

    expect(buildSharedMenuIngestion(original, metadata).contentHash)
      .not.toBe(buildSharedMenuIngestion(changed, metadata).contentHash);
  });

  it("stores normalized ranking inputs but never raw image bytes", () => {
    const payload = buildSharedMenuIngestion(
      processExtractedMenu(SAMPLE_MENU_MODEL, "text", false),
      metadata,
    );

    expect(payload.items[0].dish.rankingEmbedding.length).toBeGreaterThan(0);
    expect(payload.sourceUri).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("base64");
  });
});
