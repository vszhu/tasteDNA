"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Info, Users } from "lucide-react";
import { CampusMap } from "@/components/map/campus-map";
import { VenueCard } from "@/components/map/venue-card";
import { CMU_CAMPUS_CENTER } from "@/components/map/fixtures";
import { isCandidateSetComplete, isSelectable, MAX_CANDIDATES, MIN_CANDIDATES, toggleCandidate } from "@/components/map/selection";
import { useVenues } from "@/components/map/use-venues";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { createFriendshipClient, FriendshipClientError } from "@/lib/friendships/client";
import type { FriendshipApiSummary } from "@/lib/friendships/types";
import { createGroupSessionClient, GroupSessionClientError } from "@/lib/group-sessions/client";
import { cn } from "@/lib/utils";

const friendshipClient = createFriendshipClient();
const groupSessionClient = createGroupSessionClient();

function NewSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status } = useSession();
  const { venues, loadState, usingFallback } = useVenues();
  const [title, setTitle] = useState("Group lunch");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (searchParams.get("venues")?.split(",").filter(Boolean) ?? []));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendshipApiSummary[] | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "signed-in") return;
    const controller = new AbortController();
    void friendshipClient.list(controller.signal).then((list) => {
      setFriends(list);
      setFriendsError(null);
    }).catch((caught) => {
      if (controller.signal.aborted) return;
      setFriendsError(caught instanceof FriendshipClientError ? caught.message : "Friends are temporarily unavailable.");
    });
    return () => controller.abort();
  }, [status]);

  const selectedVenueIds = useMemo(
    () => [...new Set(selectedIds.filter((id) => venues.some((venue) => venue.id === id && isSelectable(venue))))],
    [selectedIds, venues],
  );
  const complete = !usingFallback && isCandidateSetComplete(selectedVenueIds);
  const acceptedFriends = useMemo(() => (friends ?? []).filter((friend) => friend.status === "accepted"), [friends]);

  function toggleVenue(id: string) {
    setSelectedIds((current) => toggleCandidate(
      current.filter((candidateId) => venues.some((venue) => venue.id === candidateId && isSelectable(venue))),
      id,
      venues,
    ));
  }

  function toggleInvitee(userId: string) {
    setInviteeIds((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const detail = await groupSessionClient.create({
        title: title.trim(),
        candidateVenueIds: selectedVenueIds,
        inviteeUserIds: inviteeIds,
      });
      router.push(`/sessions/${detail.session.id}`);
    } catch (caught) {
      setError(caught instanceof GroupSessionClientError ? caught.message : "We couldn’t create this session. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  if (status === "loading") {
    return <section className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--muted)]">Loading your account…</section>;
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
          <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">CANDIDATE VENUES ({selectedVenueIds.length}/{MAX_CANDIDATES})</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Pick {MIN_CANDIDATES}-{MAX_CANDIDATES} venues your group will choose between.</p>
          {usingFallback && loadState === "ready" && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4 text-sm text-[#71561d]">
              <Info className="mt-0.5 size-4 shrink-0" /> Real venue storage is unavailable, so demo venues are shown but cannot be used to create a persistent session. Check Supabase configuration and the venue sync.
            </p>
          )}
          {loadState === "loading" ? (
            <div className="mt-4 grid h-[320px] place-items-center rounded-[1.4rem] border border-[var(--line)] bg-white text-sm text-[var(--muted)]">Loading CMU venues…</div>
          ) : (
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
              <div className="h-[320px] overflow-hidden rounded-[1.4rem] border border-[var(--line)] shadow-[0_14px_45px_rgba(47,38,31,.06)]">
                <CampusMap venues={venues} center={CMU_CAMPUS_CENTER} selectedIds={selectedVenueIds} hoveredId={hoveredId} onSelectVenue={toggleVenue} />
              </div>
              <div className="grid max-h-[320px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1">
                {venues.map((venueEntry) => (
                  <VenueCard
                    key={venueEntry.id}
                    venue={venueEntry}
                    selected={selectedVenueIds.includes(venueEntry.id)}
                    onToggle={toggleVenue}
                    onHover={setHoveredId}
                    candidateDisabled={usingFallback}
                    menuHref={!usingFallback ? `/decode?venueId=${encodeURIComponent(venueEntry.id)}&venueName=${encodeURIComponent(venueEntry.name)}&returnTo=${encodeURIComponent(`/sessions/new?venues=${selectedVenueIds.join(",")}`)}` : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">INVITE FRIENDS</h2>
          {friendsError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{friendsError}</p>}
          {friends === null && !friendsError ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Loading friends…</p>
          ) : friends !== null && acceptedFriends.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              You have no friends yet. <Link href="/friends" className="font-semibold text-[var(--tomato)]">Add some first</Link>, or create the session without inviting anyone.
            </p>
          ) : friends !== null ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {acceptedFriends.map((friend) => {
                const invited = inviteeIds.includes(friend.friendUserId);
                return (
                  <button
                    key={friend.friendshipId}
                    type="button"
                    aria-pressed={invited}
                    onClick={() => toggleInvitee(friend.friendUserId)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                      invited ? "border-[var(--tomato)] bg-[var(--tomato)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--ink)]",
                    )}
                  >
                    {friend.friendDisplayName}
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        {error && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</p>}

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
