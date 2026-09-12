"use client";

import { useEffect, useState } from "react";
import { VENUE_FIXTURES } from "./fixtures";
import { mockNearbyVenuesAdapter } from "@/lib/nearby-venues/mock-adapter";
import type { Venue } from "@/types/group";

export type VenuesLoadState = "loading" | "ready";

/**
 * Fetches real CMU venues from /api/venues. Database venues remain visible
 * even before menus are attached so a signed-in user can digitize those menus
 * and make the venues eligible for a persistent group session. The checked-in
 * demo data is used only when the API itself reports its fixture fallback or
 * cannot be reached.
 */
export function useVenues(): { venues: Venue[]; loadState: VenuesLoadState; usingFallback: boolean } {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadState, setLoadState] = useState<VenuesLoadState>("loading");
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nearby = await mockNearbyVenuesAdapter.listNearbyVenues();
      try {
        const response = await fetch("/api/venues");
        if (!response.ok) throw new Error("Venue request failed");
        const data = (await response.json()) as Venue[];
        if (cancelled) return;
        const source = response.headers.get("X-TasteDNA-Venue-Source");
        if (source === "database") {
          setVenues([...data, ...nearby]);
          setUsingFallback(false);
        } else {
          setVenues([...VENUE_FIXTURES, ...nearby]);
          setUsingFallback(true);
        }
        setLoadState("ready");
      } catch {
        if (cancelled) return;
        setVenues([...VENUE_FIXTURES, ...nearby]);
        setUsingFallback(true);
        setLoadState("ready");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { venues, loadState, usingFallback };
}
