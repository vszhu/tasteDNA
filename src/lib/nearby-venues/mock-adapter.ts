import type { Venue } from "@/types/group";
import { findDuplicateVenues } from "./duplicate-check";
import type { CreateNearbyVenueResult, NearbyVenueInput } from "./types";

/**
 * Mock, localStorage-backed stand-in for a real "create a nearby venue"
 * API — no such endpoint exists yet. Kept in its own storage key,
 * independent of every other domain (taste, auth/friends, sessions).
 */

const STORAGE_KEY = "tastedna-mock-nearby-venues-v1";

let memoryStore: Venue[] | null = null;

function loadStore(): Venue[] {
  if (memoryStore) return memoryStore;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        memoryStore = JSON.parse(stored) as Venue[];
        return memoryStore;
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  memoryStore = [];
  return memoryStore;
}

function saveStore(venues: Venue[]) {
  memoryStore = venues;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(venues));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValid(input: NearbyVenueInput): boolean {
  return input.name.trim().length > 0 && input.locationLabel.trim().length > 0 && Number.isFinite(input.lat) && Number.isFinite(input.lng);
}

export const mockNearbyVenuesAdapter = {
  async listNearbyVenues(): Promise<Venue[]> {
    await delay(100);
    return loadStore();
  },

  /** Pass `force: true` to create anyway after the caller has shown the duplicate warning. */
  async createNearbyVenue(input: NearbyVenueInput, existingVenues: Venue[], options: { force?: boolean } = {}): Promise<CreateNearbyVenueResult> {
    await delay(300);
    if (!isValid(input)) return { ok: false, reason: "invalid" };

    const store = loadStore();
    const matches = findDuplicateVenues(input, [...existingVenues, ...store]);
    if (matches.length > 0 && !options.force) return { ok: false, reason: "duplicate", matches };

    const venue: Venue = {
      id: `nearby-${Date.now()}`,
      name: input.name.trim(),
      description: undefined,
      location: { label: input.locationLabel.trim(), latitude: input.lat, longitude: input.lng },
      menuItems: [],
      menuFreshness: "unknown",
    };
    saveStore([...store, venue]);
    return { ok: true, venue };
  },
};
