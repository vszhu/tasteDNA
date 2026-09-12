"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, MapPin, Users } from "lucide-react";
import { CampusMap } from "@/components/map/campus-map";
import { CMU_CAMPUS_CENTER } from "@/components/map/fixtures";
import { useVenues } from "@/components/map/use-venues";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { mockNearbyVenuesAdapter } from "@/lib/nearby-venues/mock-adapter";
import { cn } from "@/lib/utils";
import type { Venue } from "@/types/group";

export default function NewNearbyVenuePage() {
  const router = useRouter();
  const { user, status } = useSession();
  const { venues } = useVenues();
  const [name, setName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<Venue[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent, force = false) {
    event.preventDefault();
    if (!name.trim() || !locationLabel.trim()) { setError("Name and address label are both required."); return; }
    if (!pickedLocation) { setError("Tap the map to drop a pin for this venue."); return; }
    setError(null);
    setSaving(true);
    const result = await mockNearbyVenuesAdapter.createNearbyVenue(
      { name, locationLabel, lat: pickedLocation.lat, lng: pickedLocation.lng },
      venues,
      { force },
    );
    setSaving(false);
    if (result.ok) { router.push("/venues"); return; }
    if (result.reason === "duplicate") { setDuplicateMatches(result.matches); return; }
    setError("Enter a name, an address label, and drop a pin.");
  }

  if (status === "signed-out" || !user) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <Users className="mx-auto size-9 text-[var(--tomato)]" />
          <h1 className="mt-5 text-4xl">Sign in to add a venue.</h1>
          <Link href="/sign-in" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>Sign in</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-9 sm:px-6 sm:py-14">
      <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">NEARBY VENUE</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Add a spot nearby.</h1>
      <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">For a place off the CMU dining list — name it, describe where it is, and drop a pin. No address lookup, just tap the map.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div className="max-w-md">
          <label htmlFor="venue-name" className="text-sm font-bold">Venue name</label>
          <input
            id="venue-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Kiva Han"
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
          />
        </div>

        <div className="max-w-md">
          <label htmlFor="venue-label" className="text-sm font-bold">Address or description</label>
          <input
            id="venue-label"
            value={locationLabel}
            onChange={(event) => setLocationLabel(event.target.value)}
            placeholder="e.g. 125 Meyran Ave, across from campus"
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
          />
        </div>

        <div>
          <p className="text-sm font-bold">Drop a pin</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]"><MapPin className="size-3.5 shrink-0" /> Tap anywhere on the map to place or move the pin.</p>
          <div className="mt-3 h-[360px] overflow-hidden rounded-[1.4rem] border border-[var(--line)] shadow-[0_14px_45px_rgba(47,38,31,.06)]">
            <CampusMap
              venues={venues}
              center={CMU_CAMPUS_CENTER}
              selectedIds={[]}
              hoveredId={null}
              onSelectVenue={() => {}}
              pickedLocation={pickedLocation}
              onPickLocation={(lat, lng) => { setPickedLocation({ lat, lng }); setDuplicateMatches([]); }}
            />
          </div>
          {pickedLocation && <p className="mt-2 text-xs text-[var(--muted)]">Pinned at {pickedLocation.lat.toFixed(5)}, {pickedLocation.lng.toFixed(5)}</p>}
        </div>

        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}

        {duplicateMatches.length > 0 && (
          <div className="rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#71561d]"><AlertTriangle className="size-4 shrink-0" /> This looks like it might already be listed:</p>
            <ul className="mt-2 space-y-1 text-sm text-[#71561d]">
              {duplicateMatches.map((match) => <li key={match.id}>{match.name}{match.location.label ? ` — ${match.location.label}` : ""}</li>)}
            </ul>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={(event) => submit(event, true)} disabled={saving}>
              Create it anyway
            </Button>
          </div>
        )}

        <Button type="submit" size="lg" variant="accent" disabled={saving}>
          {saving ? "Saving…" : "Add venue"}
        </Button>
      </form>
    </div>
  );
}
