"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info, MapPin, Plus } from "lucide-react";
import { CampusMap } from "@/components/map/campus-map";
import { VenueCard } from "@/components/map/venue-card";
import { CMU_CAMPUS_CENTER } from "@/components/map/fixtures";
import { isCandidateSetComplete, MAX_CANDIDATES, MIN_CANDIDATES, toggleCandidate } from "@/components/map/selection";
import { useVenues } from "@/components/map/use-venues";

export default function VenuesPage() {
  const { venues, loadState, usingFallback } = useVenues();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const complete = isCandidateSetComplete(selectedIds);

  function handleToggle(id: string) {
    setSelectedIds((current) => toggleCandidate(current, id, venues));
  }

  const helperText = useMemo(() => {
    if (selectedIds.length === 0) return `Pick ${MIN_CANDIDATES}-${MAX_CANDIDATES} venues to consider for your group.`;
    if (selectedIds.length < MIN_CANDIDATES) return `Pick at least ${MIN_CANDIDATES - selectedIds.length} more.`;
    if (selectedIds.length === MAX_CANDIDATES) return "Maximum reached — remove one to swap in another.";
    return `${selectedIds.length} selected. You can pick up to ${MAX_CANDIDATES}.`;
  }, [selectedIds]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">CMU DINING</p>
          <h1 className="mt-3 text-5xl sm:text-6xl">Where’s everyone eating?</h1>
        </div>
        <Link href="/venues/new" className="mt-2 flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--ink)]">
          <Plus className="size-4" /> Add a nearby spot
        </Link>
      </div>
      <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">
        <MapPin className="mr-1 inline size-4 -translate-y-0.5" /> {helperText}
      </p>
      {usingFallback && loadState === "ready" && (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#a87a1f]">
          <Info className="size-3.5 shrink-0" /> Showing demo menus while CMU venues finish being digitized.
        </p>
      )}

      {loadState === "loading" ? (
        <div className="mt-9 grid h-[420px] place-items-center rounded-[1.4rem] border border-[var(--line)] bg-white text-sm text-[var(--muted)]">Loading CMU venues…</div>
      ) : (
        <div className="mt-9 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="h-[420px] overflow-hidden rounded-[1.4rem] border border-[var(--line)] shadow-[0_14px_45px_rgba(47,38,31,.06)] lg:h-[620px]">
            <CampusMap venues={venues} center={CMU_CAMPUS_CENTER} selectedIds={selectedIds} hoveredId={hoveredId} onSelectVenue={handleToggle} />
          </div>
          <div className="grid max-h-[620px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1">
            {venues.length === 0 ? (
              <p className="py-16 text-center text-sm text-[var(--muted)]">No CMU venues are available yet. Check back soon.</p>
            ) : (
              venues.map((venueEntry) => (
                <VenueCard key={venueEntry.id} venue={venueEntry} selected={selectedIds.includes(venueEntry.id)} onToggle={handleToggle} onHover={setHoveredId} />
              ))
            )}
          </div>
        </div>
      )}

      {complete && (
        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white p-5 sm:flex-row">
          <p className="font-bold">{selectedIds.length} venues ready for your group session.</p>
          <a href={`/sessions/new?venues=${selectedIds.join(",")}`} className="rounded-full bg-[var(--tomato)] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95">
            Start a group session
          </a>
        </div>
      )}
    </div>
  );
}
