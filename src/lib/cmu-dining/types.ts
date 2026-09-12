import type { CmuDiningLocation } from "./schema";

export type CmuDiningFallbackReason = "timeout" | "http-error" | "invalid-data" | "network-error";

export interface CmuDiningFeed {
  locations: CmuDiningLocation[];
  source: "live" | "fixture";
  capturedAt: string;
  fallbackReason?: CmuDiningFallbackReason;
}

export interface NormalizedCmuVenue {
  id: string;
  externalId: string;
  source: "cmu-eats";
  name: string;
  addressLabel: string | null;
  latitude: number;
  longitude: number;
  hours: Array<{ start: string; end: string }>;
  menuUrl: string | null;
  specials: Array<{ title: string; description: string }>;
  soups: Array<{ title: string; description: string }>;
  sourceMetadata: {
    upstreamVenueId: string;
    conceptId: string | null;
    shortDescription: string | null;
    description: string;
    detailUrl: string | null;
    acceptsOnlineOrders: boolean;
  };
  contentHash: string;
  sourceUpdatedAt: string | null;
  syncedAt: string;
  isActive: true;
}

export interface StoredVenueRow {
  id: string;
  external_id: string | null;
  source: string;
  name: string;
  address_label: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: unknown;
  menu_url: string | null;
  specials: unknown;
  soups: unknown;
  source_metadata: unknown;
  content_hash: string | null;
  source_updated_at: string | null;
  synced_at: string | null;
  is_active: boolean;
}

export interface ExistingVenueFingerprint {
  externalId: string;
  contentHash: string | null;
  isActive: boolean;
}

export interface CmuVenueRepository {
  getExistingFingerprints(externalIds: string[]): Promise<Map<string, ExistingVenueFingerprint>>;
  upsertVenues(venues: NormalizedCmuVenue[]): Promise<void>;
  listActiveVenues(): Promise<StoredVenueRow[]>;
}

export interface CmuDiningSyncResult {
  source: CmuDiningFeed["source"];
  fallbackReason?: CmuDiningFallbackReason;
  received: number;
  skipped: number;
  inserted: number;
  updated: number;
  unchanged: number;
  syncedAt: string;
}
