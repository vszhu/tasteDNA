import type { VenueSummary } from "./venue-types";

/**
 * Golden fixture of real CMU dining venues (names, locations, and coordinates
 * sourced from the public CMU Dining API, api.cmueats.com/v2/locations).
 *
 * This lets Task 1 (map + candidate picker) ship against real-looking data
 * before `/api/venues` exists. `dishCount`/`lastSyncedAt` are fixture values
 * standing in for what the real CMU ingestion pipeline will produce, and a
 * couple of entries are deliberately shaped to exercise the UI's edge-case
 * states (missing coordinates, no digitized menu yet, stale sync).
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function agoIso(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export const VENUE_FIXTURES: VenueSummary[] = [
  {
    id: "the-exchange",
    name: "The Exchange",
    shortDescription: "Deli and breakfast sandwiches, daily hot entrées, grab-and-go.",
    locationLabel: "Posner Hall, 1st Floor",
    coordinates: { lat: 40.441354, lng: -79.942125 },
    dishCount: 9,
    acceptsOnlineOrders: false,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
    ratingsAvg: 4.2,
  },
  {
    id: "schatz-dining-room",
    name: "Schatz Dining Room",
    shortDescription: "All-you-care-to-eat residential dining hall.",
    locationLabel: "Cohon Center, 2nd Floor",
    coordinates: { lat: 40.4430865629653, lng: -79.94254227553057 },
    dishCount: 0,
    acceptsOnlineOrders: false,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
    ratingsAvg: 3.9,
  },
  {
    id: "taste-of-india",
    name: "Taste of India",
    shortDescription: "Aromatic spices, rich curries, and tandoori specialties.",
    locationLabel: "Resnik House, Resnik Servery",
    coordinates: { lat: 40.44253705946464, lng: -79.9400539411368 },
    dishCount: 6,
    acceptsOnlineOrders: false,
    lastSyncedAt: agoIso(4 * DAY_MS),
    ratingsAvg: 4.5,
  },
  {
    id: "la-prima-rohr-cafe",
    name: "La Prima - Rohr Café",
    shortDescription: "Italian-style coffee and food, sandwiches and pastries.",
    locationLabel: "Gates Hillman Centers, 3rd Floor",
    coordinates: { lat: 40.44347617300122, lng: -79.94480928001676 },
    dishCount: 0,
    acceptsOnlineOrders: false,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
  },
  {
    id: "wild-blue-sushi",
    name: "Wild Blue Sushi",
    shortDescription: "Fresh prepared sushi, hot rice bowls, bubble tea and coffee.",
    locationLabel: "Scott Hall, Lower Level",
    coordinates: { lat: 40.44269873724883, lng: -79.94664155857618 },
    dishCount: 11,
    acceptsOnlineOrders: true,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
    ratingsAvg: 4.6,
  },
  {
    id: "revolution-noodle",
    name: "Revolution Noodle",
    shortDescription: "Customizable Malatang noodle bowls.",
    locationLabel: "Cohon Center, 2nd Floor, Marketplace",
    // Simulated gap: the ingestion pipeline hasn't resolved coordinates yet.
    coordinates: null,
    dishCount: 5,
    acceptsOnlineOrders: false,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
  },
  {
    id: "hunan-express",
    name: "Hunan Express",
    shortDescription: "Asian cuisine, rice bowls, boba and smoothies.",
    locationLabel: "Newell-Simon Atrium",
    coordinates: { lat: 40.443392, lng: -79.945596 },
    dishCount: 8,
    acceptsOnlineOrders: true,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
    ratingsAvg: 4.1,
  },
  {
    id: "stackd-underground",
    name: "Stack'd Underground",
    shortDescription: "Smashed burgers, Nashville-style chicken, gourmet grilled cheese.",
    locationLabel: "Morewood Gardens, Lower Level",
    coordinates: { lat: 40.44532597670513, lng: -79.94331579056744 },
    dishCount: 0,
    acceptsOnlineOrders: false,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
    ratingsAvg: 4.3,
  },
  {
    id: "defer-coffee-resnik",
    name: "De Fer Coffee & Tea @ Resnik",
    shortDescription: "Locally-roasted specialty coffee, tea, and scratch-made food.",
    locationLabel: "Resnik House",
    coordinates: { lat: 40.44246420113996, lng: -79.93979201349711 },
    dishCount: 7,
    acceptsOnlineOrders: true,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
  },
  {
    id: "scottys-market",
    name: "Scotty's Market by Salem's",
    shortDescription: "Campus grocery store with fresh produce, drinks, snacks, and grilled Mediterranean fare.",
    locationLabel: "Forbes Beeler Apartments",
    coordinates: { lat: 40.44414285761781, lng: -79.93888579754876 },
    dishCount: 0,
    acceptsOnlineOrders: false,
    lastSyncedAt: agoIso(20 * MINUTE_MS),
  },
];

export const CMU_CAMPUS_CENTER: [number, number] = [40.4443, -79.9436];
