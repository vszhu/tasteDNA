import { z } from "zod";
import type { Venue } from "@/types/group";
import { CMU_DINING_LAST_GOOD } from "./fixture";
import { normalizeCmuLocation } from "./normalize";
import type { NormalizedCmuVenue, StoredVenueRow } from "./types";
import type { SharedVenueMenu } from "@/lib/menu/shared-types";

const VenueSourceMetadataSchema = z.object({
  shortDescription: z.string().nullable().optional(),
  description: z.string().optional(),
  acceptsOnlineOrders: z.boolean().optional(),
});

function descriptionFromMetadata(metadata: unknown) {
  const parsed = VenueSourceMetadataSchema.safeParse(metadata);
  if (!parsed.success) return undefined;
  return parsed.data.shortDescription?.trim() || parsed.data.description?.trim() || undefined;
}

export function storedVenueToPublicVenue(row: StoredVenueRow, sharedMenu?: SharedVenueMenu): Venue | null {
  if (row.latitude === null || row.longitude === null) return null;
  const metadata = VenueSourceMetadataSchema.safeParse(row.source_metadata);
  const description = descriptionFromMetadata(row.source_metadata);

  return {
    id: row.id,
    name: row.name,
    ...(description ? { description } : {}),
    location: {
      ...(row.address_label ? { label: row.address_label } : {}),
      latitude: row.latitude,
      longitude: row.longitude,
    },
    menuItems: sharedMenu?.items ?? [],
    menuFreshness: sharedMenu?.freshness ?? "unknown",
    ...(sharedMenu ? { menuUpdatedAt: sharedMenu.observedAt } : {}),
    ...(metadata.success && metadata.data.acceptsOnlineOrders !== undefined
      ? { acceptsOnlineOrders: metadata.data.acceptsOnlineOrders }
      : {}),
  };
}

export function normalizedVenueToPublicVenue(venue: NormalizedCmuVenue): Venue {
  const description =
    venue.sourceMetadata.shortDescription || venue.sourceMetadata.description || undefined;
  return {
    id: venue.id,
    name: venue.name,
    ...(description ? { description } : {}),
    location: {
      ...(venue.addressLabel ? { label: venue.addressLabel } : {}),
      latitude: venue.latitude,
      longitude: venue.longitude,
    },
    menuItems: [],
    menuFreshness: "unknown",
    acceptsOnlineOrders: venue.sourceMetadata.acceptsOnlineOrders,
  };
}

export function lastGoodPublicVenues(): Venue[] {
  return CMU_DINING_LAST_GOOD.locations
    .map((location) => normalizeCmuLocation(location, CMU_DINING_LAST_GOOD.capturedAt))
    .filter((venue): venue is NormalizedCmuVenue => venue !== null)
    .map(normalizedVenueToPublicVenue);
}
