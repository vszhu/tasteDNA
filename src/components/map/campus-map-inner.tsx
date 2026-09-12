"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { getVenueAvailability } from "./selection";
import type { VenueSummary } from "./venue-types";

const AVAILABILITY_COLOR: Record<string, string> = {
  available: "#4b8a70",
  stale: "#e6a83c",
  "no-menu": "#a9a69e",
  "missing-location": "#a9a69e",
};

function markerIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${selected ? 22 : 16}px;height:${selected ? 22 : 16}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
    iconSize: [selected ? 22 : 16, selected ? 22 : 16],
    iconAnchor: [selected ? 11 : 8, selected ? 11 : 8],
  });
}

function FlyToVenue({ target }: { target: VenueSummary | null }) {
  const map = useMap();
  useEffect(() => {
    if (target?.coordinates) map.flyTo([target.coordinates.lat, target.coordinates.lng], Math.max(map.getZoom(), 17), { duration: 0.5 });
  }, [target, map]);
  return null;
}

export function CampusMapInner({
  venues,
  center,
  selectedIds,
  hoveredId,
  onSelectVenue,
}: {
  venues: VenueSummary[];
  center: [number, number];
  selectedIds: string[];
  hoveredId: string | null;
  onSelectVenue: (id: string) => void;
}) {
  const locatable = useMemo(() => venues.filter((venue) => venue.coordinates), [venues]);
  const flyTarget = useMemo(() => locatable.find((venue) => venue.id === hoveredId) ?? null, [locatable, hoveredId]);

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom className="h-full w-full">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FlyToVenue target={flyTarget} />
      {locatable.map((venueEntry) => {
        const availability = getVenueAvailability(venueEntry);
        const selected = selectedIds.includes(venueEntry.id);
        return (
          <Marker
            key={venueEntry.id}
            position={[venueEntry.coordinates!.lat, venueEntry.coordinates!.lng]}
            icon={markerIcon(AVAILABILITY_COLOR[availability], selected)}
            eventHandlers={{ click: () => onSelectVenue(venueEntry.id) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>{venueEntry.name}</Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
