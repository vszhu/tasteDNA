"use client";

import Link from "next/link";
import { AlertCircle, Check, Clock, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getVenueAvailability, isSelectable } from "./selection";
import type { Venue } from "@/types/group";

const AVAILABILITY_COPY: Record<string, { label: string; icon: typeof AlertCircle; className: string }> = {
  "no-menu": { label: "No digitized menu yet", icon: UtensilsCrossed, className: "text-[var(--muted)]" },
  stale: { label: "Menu data may be outdated", icon: Clock, className: "text-[#a87a1f]" },
  available: { label: "", icon: Check, className: "" },
};

export function VenueCard({
  venue: venueEntry,
  selected,
  onToggle,
  onHover,
  menuHref,
  candidateDisabled = false,
}: {
  venue: Venue;
  selected: boolean;
  onToggle: (id: string) => void;
  onHover: (id: string | null) => void;
  menuHref?: string;
  candidateDisabled?: boolean;
}) {
  const availability = getVenueAvailability(venueEntry);
  const selectable = isSelectable(venueEntry);
  const canSelect = selectable && !candidateDisabled;
  const status = AVAILABILITY_COPY[availability];
  const StatusIcon = status.icon;

  return (
    <Card
      className={cn("transition-all", selected ? "border-[var(--tomato)] ring-2 ring-[var(--tomato)]/20" : "")}
      onMouseEnter={() => onHover(venueEntry.id)}
      onMouseLeave={() => onHover(null)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{venueEntry.name}</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{venueEntry.location.label}</p>
          </div>
          {venueEntry.acceptsOnlineOrders && <Badge className="shrink-0 text-[var(--tomato)]"><ShoppingBag className="mr-1 size-3" /> Online orders</Badge>}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{venueEntry.description}</p>
        {availability !== "available" && (
          <p className={cn("mt-3 flex items-center gap-1.5 text-xs font-semibold", status.className)}>
            <StatusIcon className="size-3.5 shrink-0" /> {status.label}
          </p>
        )}
        {!selectable && menuHref ? (
          <Link href={menuHref} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--tomato)] transition-all hover:border-[var(--tomato)]">
            <UtensilsCrossed className="size-4" /> Add menu to use
          </Link>
        ) : (
          <button
            type="button"
            disabled={!canSelect}
            aria-pressed={selected}
            onClick={() => onToggle(venueEntry.id)}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "border-[var(--tomato)] bg-[var(--tomato)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--ink)]",
            )}
          >
            {selected ? (
              <>
                <Check className="size-4" /> Selected
              </>
            ) : candidateDisabled ? (
              "Demo only"
            ) : selectable ? (
              "Add as candidate"
            ) : (
              "Unavailable"
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
