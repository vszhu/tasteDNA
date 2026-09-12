import { describe, expect, it } from "vitest";
import { CMU_DINING_LAST_GOOD } from "./fixture";
import type {
  CmuDiningFeed,
  CmuVenueRepository,
  ExistingVenueFingerprint,
  NormalizedCmuVenue,
  StoredVenueRow,
} from "./types";
import { syncCmuDiningVenues } from "./sync";

const NOW = new Date("2026-09-12T12:00:00.000Z");

class MemoryVenueRepository implements CmuVenueRepository {
  readonly values = new Map<string, NormalizedCmuVenue>();
  writes: NormalizedCmuVenue[][] = [];

  async getExistingFingerprints(externalIds: string[]) {
    return new Map<string, ExistingVenueFingerprint>(
      externalIds.flatMap((externalId) => {
        const venue = this.values.get(externalId);
        return venue
          ? [[externalId, { externalId, contentHash: venue.contentHash, isActive: venue.isActive }]]
          : [];
      }),
    );
  }

  async upsertVenues(venues: NormalizedCmuVenue[]) {
    this.writes.push(venues);
    for (const venue of venues) this.values.set(venue.externalId, venue);
  }

  async listActiveVenues(): Promise<StoredVenueRow[]> {
    return [];
  }
}

function feed(source: CmuDiningFeed["source"] = "live"): CmuDiningFeed {
  return {
    source,
    capturedAt: NOW.toISOString(),
    locations: [CMU_DINING_LAST_GOOD.locations[0]],
    ...(source === "fixture" ? { fallbackReason: "network-error" as const } : {}),
  };
}

describe("CMU Dining sync", () => {
  it("is idempotent for duplicate syncs", async () => {
    const repository = new MemoryVenueRepository();
    const options = { loadFeed: async () => feed(), now: () => NOW };

    const first = await syncCmuDiningVenues(repository, options);
    const second = await syncCmuDiningVenues(repository, options);

    expect(first).toEqual(expect.objectContaining({ inserted: 1, updated: 0, unchanged: 0 }));
    expect(second).toEqual(expect.objectContaining({ inserted: 0, updated: 0, unchanged: 1 }));
    expect(repository.writes.map((write) => write.length)).toEqual([1, 0]);
  });

  it("updates a venue when its hours change", async () => {
    const repository = new MemoryVenueRepository();
    await syncCmuDiningVenues(repository, { loadFeed: async () => feed(), now: () => NOW });
    const start = Date.UTC(2026, 8, 12, 14);
    const changedFeed: CmuDiningFeed = {
      ...feed(),
      locations: [{
        ...CMU_DINING_LAST_GOOD.locations[0],
        times: [{ start, end: start + 3_600_000 }],
      }],
    };

    const result = await syncCmuDiningVenues(repository, {
      loadFeed: async () => changedFeed,
      now: () => NOW,
    });

    expect(result).toEqual(expect.objectContaining({ inserted: 0, updated: 1, unchanged: 0 }));
  });

  it("never overwrites existing live data with the outage fixture", async () => {
    const repository = new MemoryVenueRepository();
    await syncCmuDiningVenues(repository, { loadFeed: async () => feed(), now: () => NOW });
    const result = await syncCmuDiningVenues(repository, {
      loadFeed: async () => feed("fixture"),
      now: () => NOW,
    });

    expect(result).toEqual(expect.objectContaining({ source: "fixture", updated: 0, unchanged: 1 }));
    expect(repository.writes.at(-1)).toEqual([]);
  });
});
