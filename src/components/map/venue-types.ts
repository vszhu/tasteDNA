/**
 * Temporary stand-in for the shared group-domain contract.
 *
 * Developer 2 owns `src/types/group.ts` (see docs/team + the shared plan doc).
 * That file doesn't exist yet, so this shape mirrors what `Venue`/`VenueSummary`
 * are expected to look like, scoped to this component tree only. Once the real
 * shared contract lands, swap these imports for `@/types/group` and delete this
 * file — the field names below were chosen to match 1:1 for an easy migration.
 */

export interface VenueCoordinates {
  lat: number;
  lng: number;
}

export type VenueAvailability = "available" | "missing-location" | "no-menu" | "stale";

export interface VenueSummary {
  id: string;
  name: string;
  shortDescription: string;
  locationLabel: string;
  /** null means the source data has no coordinates for this venue yet. */
  coordinates: VenueCoordinates | null;
  /** Number of digitized dishes available for this venue right now. */
  dishCount: number;
  acceptsOnlineOrders: boolean;
  /** ISO timestamp of the last successful sync, or null if never synced. */
  lastSyncedAt: string | null;
  ratingsAvg?: number;
}
