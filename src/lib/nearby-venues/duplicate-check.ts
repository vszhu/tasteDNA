import type { Venue } from "@/types/group";
import type { NearbyVenueInput } from "./types";

const EARTH_RADIUS_METERS = 6371000;
export const DUPLICATE_DISTANCE_METERS = 75;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in meters. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h = sinLat * sinLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Flags existing venues that are probably the same place: an
 * (almost) exact name match, or a pin close enough to already be covered.
 * No geocoding/search involved — just simple, explainable proximity math.
 */
export function findDuplicateVenues(input: NearbyVenueInput, existingVenues: Venue[]): Venue[] {
  const inputName = normalizedName(input.name);
  return existingVenues.filter((venue) => {
    if (normalizedName(venue.name) === inputName) return true;
    return distanceMeters(input, { lat: venue.location.latitude, lng: venue.location.longitude }) <= DUPLICATE_DISTANCE_METERS;
  });
}
