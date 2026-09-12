import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CmuVenueRepository,
  ExistingVenueFingerprint,
  NormalizedCmuVenue,
  StoredVenueRow,
} from "./types";

const VENUE_SELECT = [
  "id",
  "external_id",
  "source",
  "name",
  "address_label",
  "latitude",
  "longitude",
  "hours",
  "menu_url",
  "specials",
  "soups",
  "source_metadata",
  "content_hash",
  "source_updated_at",
  "synced_at",
  "is_active",
].join(",");

function venueRow(venue: NormalizedCmuVenue) {
  return {
    id: venue.id,
    external_id: venue.externalId,
    source: venue.source,
    name: venue.name,
    address_label: venue.addressLabel,
    latitude: venue.latitude,
    longitude: venue.longitude,
    hours: venue.hours,
    menu_url: venue.menuUrl,
    specials: venue.specials,
    soups: venue.soups,
    source_metadata: venue.sourceMetadata,
    content_hash: venue.contentHash,
    source_updated_at: venue.sourceUpdatedAt,
    synced_at: venue.syncedAt,
    is_active: venue.isActive,
  };
}

export class SupabaseCmuVenueRepository implements CmuVenueRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getExistingFingerprints(externalIds: string[]) {
    if (externalIds.length === 0) return new Map<string, ExistingVenueFingerprint>();
    const { data, error } = await this.client
      .from("venues")
      .select("external_id,content_hash,is_active")
      .in("external_id", externalIds);
    if (error) throw new Error("Unable to read existing CMU venue fingerprints.");

    const rows = (data ?? []) as Array<{
      external_id: string | null;
      content_hash: string | null;
      is_active: boolean;
    }>;
    return new Map(
      rows
        .filter((row): row is typeof row & { external_id: string } => row.external_id !== null)
        .map((row) => [row.external_id, {
          externalId: row.external_id,
          contentHash: row.content_hash,
          isActive: row.is_active,
        }]),
    );
  }

  async upsertVenues(venues: NormalizedCmuVenue[]) {
    if (venues.length === 0) return;
    const { error } = await this.client
      .from("venues")
      .upsert(venues.map(venueRow), { onConflict: "external_id" });
    if (error) throw new Error("Unable to persist the CMU venue sync.");
  }

  async listActiveVenues() {
    const { data, error } = await this.client
      .from("venues")
      .select(VENUE_SELECT)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error("Unable to load active venues.");
    return (data ?? []) as unknown as StoredVenueRow[];
  }
}
