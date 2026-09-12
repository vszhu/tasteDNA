"use client";

import { useEffect, useState } from "react";
import { VENUE_FIXTURES } from "./fixtures";
import { isSelectable } from "./selection";
import { mockNearbyVenuesAdapter } from "@/lib/nearby-venues/mock-adapter";
import type { Venue } from "@/types/group";

export type VenuesLoadState = "loading" | "ready";

/**
 * Fetches real CMU venues from /api/venues, falling back to demo fixtures if
 * none are selectable yet or the request fails, then appends any venues a
 * user has manually pinned nearby (Task 6) — no dedicated backend for those
 * exists yet either, so they come from the same kind of local mock store.
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
        if (data.some((venue) => isSelectable(venue))) {
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
