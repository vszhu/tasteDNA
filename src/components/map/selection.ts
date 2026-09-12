import type { Venue } from "@/types/group";

export type VenueAvailability = "available" | "no-menu" | "stale";

export const MIN_CANDIDATES = 3;
export const MAX_CANDIDATES = 5;

/** Classifies a venue for candidate-picker UI state. */
export function getVenueAvailability(venue: Venue): VenueAvailability {
  if (venue.menuItems.length === 0) return "no-menu";
  if (venue.menuFreshness === "stale") return "stale";
  return "available";
}

/** A venue can be picked as a group-dining candidate if it has at least one digitized dish. */
export function isSelectable(venue: Venue): boolean {
  const availability = getVenueAvailability(venue);
  return availability === "available" || availability === "stale";
}

/**
 * Toggles a venue in the candidate selection, enforcing the product rule of
 * 3-5 candidates and refusing to select unavailable venues. Returns the same
 * array reference when the toggle is a no-op, so callers can skip re-renders.
 */
export function toggleCandidate(selectedIds: string[], venueId: string, venues: Venue[]): string[] {
  if (selectedIds.includes(venueId)) return selectedIds.filter((id) => id !== venueId);
  const venue = venues.find((candidate) => candidate.id === venueId);
  if (!venue || !isSelectable(venue)) return selectedIds;
  if (selectedIds.length >= MAX_CANDIDATES) return selectedIds;
  return [...selectedIds, venueId];
}

export function isCandidateSetComplete(selectedIds: string[]): boolean {
  return selectedIds.length >= MIN_CANDIDATES && selectedIds.length <= MAX_CANDIDATES;
}
