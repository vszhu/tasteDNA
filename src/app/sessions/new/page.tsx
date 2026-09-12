"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { CampusMap } from "@/components/map/campus-map";
import { VenueCard } from "@/components/map/venue-card";
import { CMU_CAMPUS_CENTER } from "@/components/map/fixtures";
import { isCandidateSetComplete, MAX_CANDIDATES, MIN_CANDIDATES, toggleCandidate } from "@/components/map/selection";
import { useVenues } from "@/components/map/use-venues";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { mockFriendsAdapter } from "@/lib/auth/mock-adapter";
import type { Friend } from "@/lib/auth/types";
import { mockSessionAdapter } from "@/lib/session/mock-session-adapter";
import { cn } from "@/lib/utils";

function NewSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status } = useSession();
  const { venues, loadState } = useVenues();
  const [title, setTitle] = useState("Group lunch");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (searchParams.get("venues")?.split(",").filter(Boolean) ?? []));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "signed-in") mockFriendsAdapter.listFriends().then(setFriends);
  }, [status]);

  const complete = isCandidateSetComplete(selectedIds);
  const acceptedFriends = useMemo(() => (friends ?? []).filter((friend) => friend.status === "accepted"), [friends]);

  function toggleVenue(id: string) {
    setSelectedIds((current) => toggleCandidate(current, id, venues));
  }

  function toggleInvitee(friendshipId: string) {
    setInviteeIds((current) => (current.includes(friendshipId) ? current.filter((id) => id !== friendshipId) : [...current, friendshipId]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || !title.trim()) return;
    setCreating(true);
    const invitees = acceptedFriends
      .filter((friend) => inviteeIds.includes(friend.friendshipId))
      .map((friend) => ({ userId: friend.user.id, displayName: friend.user.displayName }));
    const session = await mockSessionAdapter.createSession({ title: title.trim(), candidateVenueIds: selectedIds, inviteeUserIds: invitees });
    router.push(`/sessions/${session.id}`);
  }

  if (status === "signed-out" || !user) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <Users className="mx-auto size-9 text-[var(--tomato)]" />
          <h1 className="mt-5 text-4xl">Sign in to start a session.</h1>
          <p className="mt-3 text-[var(--muted)]">Group dining sessions need a signed-in creator.</p>
          <Link href="/sign-in" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>Sign in</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">NEW SESSION</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Plan a group meal.</h1>

      <form onSubmit={submit} className="mt-9 space-y-10">
        <div className="max-w-md">
          <label htmlFor="title" className="text-sm font-bold">Session name</label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
          />
        </div>

        <section>
          <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">CANDIDATE VENUES ({selectedIds.length}/{MAX_CANDIDATES})</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Pick {MIN_CANDIDATES}-{MAX_CANDIDATES} venues your group will choose between.</p>
          {loadState === "loading" ? (
            <div className="mt-4 grid h-[320px] place-items-center rounded-[1.4rem] border border-[var(--line)] bg-white text-sm text-[var(--muted)]">Loading CMU venues…</div>
          ) : (
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
              <div className="h-[320px] overflow-hidden rounded-[1.4rem] border border-[var(--line)] shadow-[0_14px_45px_rgba(47,38,31,.06)]">
                <CampusMap venues={venues} center={CMU_CAMPUS_CENTER} selectedIds={selectedIds} hoveredId={hoveredId} onSelectVenue={toggleVenue} />
              </div>
              <div className="grid max-h-[320px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1">
                {venues.map((venueEntry) => (
                  <VenueCard key={venueEntry.id} venue={venueEntry} selected={selectedIds.includes(venueEntry.id)} onToggle={toggleVenue} onHover={setHoveredId} />
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">INVITE FRIENDS</h2>
          {friends === null ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Loading friends…</p>
          ) : acceptedFriends.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              You have no friends yet. <Link href="/friends" className="font-semibold text-[var(--tomato)]">Add some first</Link>, or create the session without inviting anyone.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {acceptedFriends.map((friend) => {
                const invited = inviteeIds.includes(friend.friendshipId);
                return (
                  <button
                    key={friend.friendshipId}
                    type="button"
                    aria-pressed={invited}
                    onClick={() => toggleInvitee(friend.friendshipId)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                      invited ? "border-[var(--tomato)] bg-[var(--tomato)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--ink)]",
                    )}
                  >
                    {friend.user.displayName}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Button type="submit" size="lg" variant="accent" disabled={!complete || !title.trim() || creating}>
          {creating ? "Creating…" : "Create session"} <ArrowRight className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[var(--muted)]">Loading…</div>}>
      <NewSessionForm />
    </Suspense>
  );
}
