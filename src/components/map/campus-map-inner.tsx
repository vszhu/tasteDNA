"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Venue } from "@/types/group";
import { getVenueAvailability } from "./selection";

const AVAILABILITY_COLOR: Record<string, string> = {
  available: "#4b8a70",
  stale: "#e6a83c",
  "no-menu": "#a9a69e",
};

function markerIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${selected ? 22 : 16}px;height:${selected ? 22 : 16}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
    iconSize: [selected ? 22 : 16, selected ? 22 : 16],
    iconAnchor: [selected ? 11 : 8, selected ? 11 : 8],
  });
}

function pickedLocationIcon() {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:26px;height:26px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#d6533e;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

/** Listens for map clicks and reports them when pick mode is active — no other behavior change. */
function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function FlyToVenue({ target }: { target: Venue | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.location.latitude, target.location.longitude], Math.max(map.getZoom(), 17), { duration: 0.5 });
  }, [target, map]);
  return null;
}

export function CampusMapInner({
  venues,
  center,
  selectedIds,
  hoveredId,
  onSelectVenue,
  pickedLocation,
  onPickLocation,
}: {
  venues: Venue[];
  center: [number, number];
  selectedIds: string[];
  hoveredId: string | null;
  onSelectVenue: (id: string) => void;
  /** When set alongside onPickLocation, clicking the map drops/moves a pin here instead of selecting a venue. */
  pickedLocation?: { lat: number; lng: number } | null;
  onPickLocation?: (lat: number, lng: number) => void;
}) {
  const flyTarget = useMemo(() => venues.find((venue) => venue.id === hoveredId) ?? null, [venues, hoveredId]);

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom className="h-full w-full">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FlyToVenue target={flyTarget} />
      {onPickLocation && <LocationPicker onPick={onPickLocation} />}
      {pickedLocation && <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickedLocationIcon()} />}
      {venues.map((venueEntry) => {
        const availability = getVenueAvailability(venueEntry);
        const selected = selectedIds.includes(venueEntry.id);
        return (
          <Marker
            key={venueEntry.id}
            position={[venueEntry.location.latitude, venueEntry.location.longitude]}
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
