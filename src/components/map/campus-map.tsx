"use client";

import dynamic from "next/dynamic";
import type { Venue } from "@/types/group";

const CampusMapInner = dynamic(() => import("./campus-map-inner").then((mod) => mod.CampusMapInner), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-sm text-[var(--muted)]">Loading map…</div>,
});

export function CampusMap(props: {
  venues: Venue[];
  center: [number, number];
  selectedIds: string[];
  hoveredId: string | null;
  onSelectVenue: (id: string) => void;
}) {
  return <CampusMapInner {...props} />;
}
