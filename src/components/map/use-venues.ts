"use client";

import { useEffect, useState } from "react";
import { VENUE_FIXTURES } from "./fixtures";
import { isSelectable } from "./selection";
import type { Venue } from "@/types/group";

export type VenuesLoadState = "loading" | "ready";

/** Fetches real CMU venues from /api/venues, falling back to demo fixtures if none are selectable yet or the request fails. */
export function useVenues(): { venues: Venue[]; loadState: VenuesLoadState; usingFallback: boolean } {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadState, setLoadState] = useState<VenuesLoadState>("loading");
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/venues");
        if (!response.ok) throw new Error("Venue request failed");
        const data = (await response.json()) as Venue[];
        if (cancelled) return;
        if (data.some((venue) => isSelectable(venue))) {
          setVenues(data);
          setUsingFallback(false);
        } else {
          setVenues(VENUE_FIXTURES);
          setUsingFallback(true);
        }
        setLoadState("ready");
      } catch {
        if (cancelled) return;
        setVenues(VENUE_FIXTURES);
        setUsingFallback(true);
        setLoadState("ready");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { venues, loadState, usingFallback };
}
