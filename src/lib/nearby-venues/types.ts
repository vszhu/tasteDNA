import type { Venue } from "@/types/group";

export interface NearbyVenueInput {
  name: string;
  locationLabel: string;
  lat: number;
  lng: number;
}

export type CreateNearbyVenueResult =
  | { ok: true; venue: Venue }
  | { ok: false; reason: "duplicate"; matches: Venue[] }
  | { ok: false; reason: "invalid" };
