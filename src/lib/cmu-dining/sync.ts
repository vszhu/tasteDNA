import { fetchCmuDiningFeed } from "./client";
import { normalizeCmuLocation } from "./normalize";
import type { CmuDiningFeed, CmuDiningSyncResult, CmuVenueRepository } from "./types";

interface CmuDiningSyncOptions {
  loadFeed?: () => Promise<CmuDiningFeed>;
  now?: () => Date;
}

export async function syncCmuDiningVenues(
  repository: CmuVenueRepository,
  options: CmuDiningSyncOptions = {},
): Promise<CmuDiningSyncResult> {
  const loadFeed = options.loadFeed ?? fetchCmuDiningFeed;
  const now = options.now ?? (() => new Date());
  const feed = await loadFeed();
  const syncedAt = now().toISOString();
  const unique = new Map(
    feed.locations
      .map((location) => normalizeCmuLocation(location, syncedAt))
      .filter((venue) => venue !== null)
      .map((venue) => [venue.externalId, venue]),
  );
  const venues = [...unique.values()];
  const existing = await repository.getExistingFingerprints(venues.map((venue) => venue.externalId));
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const writes = venues.filter((venue) => {
    const previous = existing.get(venue.externalId);
    if (!previous) {
      inserted += 1;
      return true;
    }
    // A checked-in fallback can fill an empty database, but never overwrites
    // newer live data during an upstream outage.
    if (feed.source === "fixture") {
      unchanged += 1;
      return false;
    }
    if (previous.contentHash === venue.contentHash && previous.isActive) {
      unchanged += 1;
      return false;
    }
    updated += 1;
    return true;
  });

  await repository.upsertVenues(writes);

  return {
    source: feed.source,
    fallbackReason: feed.fallbackReason,
    received: feed.locations.length,
    skipped: feed.locations.length - venues.length,
    inserted,
    updated,
    unchanged,
    syncedAt,
  };
}
