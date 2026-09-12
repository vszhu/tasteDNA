import { NextResponse } from "next/server";
import { lastGoodPublicVenues, storedVenueToPublicVenue } from "@/lib/cmu-dining/public-venues";
import { SupabaseCmuVenueRepository } from "@/lib/cmu-dining/repository";
import { getSupabasePublicServerClient } from "@/lib/db/supabase-server";
import { SupabaseSharedMenuRepository } from "@/lib/menu/shared-repository";
import type { SharedVenueMenu } from "@/lib/menu/shared-types";
import type { Venue } from "@/types/group";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function venueResponse(venues: Venue[], source: "database" | "fixture") {
  return NextResponse.json(venues, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "X-TasteDNA-Venue-Source": source,
    },
  });
}

/** Reads the persisted cache only; ordinary page loads never call the CMU feed. */
export async function GET() {
  const client = getSupabasePublicServerClient();
  if (client) {
    try {
      const rows = await new SupabaseCmuVenueRepository(client).listActiveVenues();
      let sharedMenus = new Map<string, SharedVenueMenu>();
      try {
        sharedMenus = await new SupabaseSharedMenuRepository(client)
          .listNewestValidForVenues(rows.map((row) => row.id));
      } catch {
        // Venue discovery remains available while shared-menu reads recover.
      }
      const venues = rows
        .map((row) => storedVenueToPublicVenue(row, sharedMenus.get(row.id)))
        .filter((venue): venue is Venue => venue !== null);
      if (venues.length > 0) return venueResponse(venues, "database");
    } catch {
      // The checked-in cache keeps the hackathon demo usable during DB outages.
    }
  }

  return venueResponse(lastGoodPublicVenues(), "fixture");
}
