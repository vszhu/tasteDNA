import type { VenueAvailability, VenueSummary } from "./venue-types";

export const MIN_CANDIDATES = 3;
export const MAX_CANDIDATES = 5;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Classifies a venue for candidate-picker UI state, given the current time. */
export function getVenueAvailability(venue: VenueSummary, now: Date = new Date()): VenueAvailability {
  if (!venue.coordinates) return "missing-location";
  if (venue.dishCount === 0) return "no-menu";
  if (!venue.lastSyncedAt || now.getTime() - new Date(venue.lastSyncedAt).getTime() > STALE_THRESHOLD_MS) return "stale";
  return "available";
}

/** A venue can be picked as a group-dining candidate if it has a location and at least one digitized dish. */
export function isSelectable(venue: VenueSummary, now: Date = new Date()): boolean {
  const availability = getVenueAvailability(venue, now);
  return availability === "available" || availability === "stale";
}

/**
 * Toggles a venue in the candidate selection, enforcing the product rule of
 * 3-5 candidates and refusing to select unavailable venues. Returns the same
 * array reference when the toggle is a no-op, so callers can skip re-renders.
 */
export function toggleCandidate(selectedIds: string[], venueId: string, venues: VenueSummary[], now: Date = new Date()): string[] {
  if (selectedIds.includes(venueId)) return selectedIds.filter((id) => id !== venueId);
  const venue = venues.find((candidate) => candidate.id === venueId);
  if (!venue || !isSelectable(venue, now)) return selectedIds;
  if (selectedIds.length >= MAX_CANDIDATES) return selectedIds;
  return [...selectedIds, venueId];
}

export function isCandidateSetComplete(selectedIds: string[]): boolean {
  return selectedIds.length >= MIN_CANDIDATES && selectedIds.length <= MAX_CANDIDATES;
}
