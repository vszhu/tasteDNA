import { describe, expect, it } from "vitest";
import { selectNewestValidMenus, type VersionedMenuCandidate } from "./shared-selection";

function candidate(overrides: Partial<VersionedMenuCandidate<string>> = {}): VersionedMenuCandidate<string> {
  return {
    venueId: "venue-1",
    version: 1,
    observedAt: "2026-09-01T00:00:00.000Z",
    validFrom: "2026-09-01T00:00:00.000Z",
    validUntil: null,
    value: "menu-1",
    ...overrides,
  };
}

describe("current shared menu selection", () => {
  const now = new Date("2026-09-12T00:00:00.000Z");

  it("selects the newest version that is valid now", () => {
    const selected = selectNewestValidMenus([
      candidate({ version: 1, validUntil: "2026-09-05T00:00:00.000Z" }),
      candidate({ version: 2, value: "menu-2", validFrom: "2026-09-05T00:00:00.000Z" }),
      candidate({ version: 3, value: "future", validFrom: "2026-10-01T00:00:00.000Z" }),
    ], now);

    expect(selected.get("venue-1")?.value).toBe("menu-2");
  });

  it("marks an old but still-current menu stale", () => {
    const selected = selectNewestValidMenus([
      candidate({ observedAt: "2026-06-01T00:00:00.000Z" }),
    ], now);
    expect(selected.get("venue-1")?.freshness).toBe("stale");
  });

  it("marks a recently observed current menu fresh", () => {
    const selected = selectNewestValidMenus([candidate()], now);
    expect(selected.get("venue-1")?.freshness).toBe("fresh");
  });
});
