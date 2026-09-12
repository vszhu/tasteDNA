import { createHash } from "node:crypto";
import type { CmuDiningLocation, CmuDiningSpecial } from "./schema";
import type { NormalizedCmuVenue } from "./types";

const CMU_VENUE_NAMESPACE = "6ef8de18-5d4f-4c43-80cc-e6749f35a77b";

function namespaceBytes(namespace: string) {
  const hex = namespace.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("Invalid UUID namespace.");
  return Buffer.from(hex, "hex");
}

/** A dependency-free UUIDv5 implementation for stable database primary keys. */
export function deterministicVenueId(externalId: string) {
  const digest = createHash("sha1")
    .update(namespaceBytes(CMU_VENUE_NAMESPACE))
    .update(externalId)
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeUrl(value: string | null) {
  if (!value?.trim()) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function normalizeSpecial(item: CmuDiningSpecial) {
  return {
    title: ("name" in item ? item.name : item.title).trim(),
    description: item.description.trim(),
  };
}

function stableSpecials(items: CmuDiningSpecial[]) {
  return items
    .map(normalizeSpecial)
    .filter((item) => item.title.length > 0)
    .sort((left, right) => left.title.localeCompare(right.title) || left.description.localeCompare(right.description));
}

export function normalizeCmuLocation(
  location: CmuDiningLocation,
  syncedAt: string,
): NormalizedCmuVenue | null {
  const name = location.name?.trim();
  const { coordinateLat: latitude, coordinateLng: longitude } = location;
  if (!name || latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const conceptId = location.conceptId?.trim() || null;
  const externalId = conceptId ? `cmu:${conceptId}` : `cmu:id:${location.id}`;
  const hours = location.times
    .filter((range) => range.end > range.start)
    .map((range) => ({
      start: new Date(range.start).toISOString(),
      end: new Date(range.end).toISOString(),
    }))
    .sort((left, right) => left.start.localeCompare(right.start));
  const specials = stableSpecials(location.todaysSpecials);
  const soups = stableSpecials(location.todaysSoups);
  const menuUrl = normalizeUrl(location.menu);
  const detailUrl = normalizeUrl(location.url);
  const sourceMetadata = {
    upstreamVenueId: location.id,
    conceptId,
    shortDescription: location.shortDescription?.trim() || null,
    description: location.description.trim(),
    detailUrl,
    acceptsOnlineOrders: location.acceptsOnlineOrders,
  };
  const content = {
    externalId,
    name,
    addressLabel: location.location.trim() || null,
    latitude,
    longitude,
    hours,
    menuUrl,
    specials,
    soups,
    sourceMetadata,
  };

  return {
    id: deterministicVenueId(externalId),
    ...content,
    source: "cmu-eats",
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    sourceUpdatedAt: null,
    syncedAt,
    isActive: true,
  };
}
