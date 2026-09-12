"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, Clock, Copy, RefreshCw, Sparkles, UserPlus, Users, X } from "lucide-react";
import { VenueCard } from "@/components/map/venue-card";
import { isCandidateSetComplete, isSelectable, toggleCandidate } from "@/components/map/selection";
import { useVenues } from "@/components/map/use-venues";
import { VenueIngredientDetails } from "@/components/group/venue-ingredient-details";
import { GroupMedicationCard } from "@/components/medications/group-medication-card";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createFriendshipClient } from "@/lib/friendships/client";
import type { FriendshipApiSummary } from "@/lib/friendships/types";
import { createGroupSessionClient, GroupSessionClientError } from "@/lib/group-sessions/client";
import type { GroupSessionDetail, SessionMemberSummary } from "@/lib/group-sessions/types";
import { cycleTagPreference, EMPTY_MEAL_PREFERENCE_STATE, setMaxPrice, tagPreference, toggleExcludedIngredient, toggleExcludedProteinType } from "@/lib/session/meal-preferences";
import { MEAL_PREFERENCE_TAGS } from "@/types/group";
import { cn } from "@/lib/utils";
import { signInPath } from "@/lib/auth/callback";
import { sessionInviteUrl } from "@/lib/group-sessions/invite-link";

const PROTEIN_PRESETS = ["Chicken", "Beef", "Pork", "Shellfish", "Fish", "Tofu", "Dairy"];
const groupSessionClient = createGroupSessionClient();
const friendshipClient = createFriendshipClient();

const MEMBER_STATUS_COPY: Record<SessionMemberSummary["status"], { label: string; icon: typeof Check; className: string }> = {
  invited: { label: "Invited", icon: Clock, className: "text-[var(--muted)]" },
  joined: { label: "Joined", icon: Users, className: "text-[var(--muted)]" },
  responded: { label: "Ready", icon: Check, className: "text-[#315e4b]" },
  declined: { label: "Declined", icon: X, className: "text-[var(--muted)]" },
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof GroupSessionClientError ? error.message : fallback;
}

export default function SessionRoomPage() {
  const { user, status } = useSession();
  const { id } = useParams<{ id: string }>();
  return <SessionRoomAccount key={`${status}:${user?.id ?? "anonymous"}:${id}`} />;
}

function SessionRoomAccount() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const { user, status } = useSession();
  const { venues, loadState: venuesLoadState, usingFallback } = useVenues();
  const [detail, setDetail] = useState<GroupSessionDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<number | undefined>();
  const [preferenceState, setPreferenceState] = useState(EMPTY_MEAL_PREFERENCE_STATE);
  const initializedPreferences = useRef<string | null>(null);
  const [ingredientInput, setIngredientInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [responding, setResponding] = useState(false);
  const [computing, setComputing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [friends, setFriends] = useState<FriendshipApiSummary[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [editingCandidates, setEditingCandidates] = useState<string[] | null>(null);
  const [savingCandidates, setSavingCandidates] = useState(false);

  const loadSession = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await groupSessionClient.get(sessionId, signal);
      setDetail(next);
      setLoadError(null);
      setLoadStatus(undefined);
      if (user && initializedPreferences.current !== `${sessionId}:${user.id}` && next.ownMealPreferenceState) {
        setPreferenceState(next.ownMealPreferenceState);
        initializedPreferences.current = `${sessionId}:${user.id}`;
      }
    } catch (error) {
      if (signal?.aborted) return;
      setDetail(null);
      setLoadError(errorMessage(error, "We couldn’t load this session."));
      setLoadStatus(error instanceof GroupSessionClientError ? error.status : undefined);
    }
  }, [sessionId, user]);

  useEffect(() => {
    if (status !== "signed-in" || !user) return;
    initializedPreferences.current = null;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial authenticated API hydration
    void loadSession(controller.signal);
    const refresh = () => {
      if (document.visibilityState === "visible") void loadSession();
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadSession, status, user]);

  const isCreator = Boolean(user && detail?.session.createdByUserId === user.id);
  useEffect(() => {
    if (!isCreator) return;
    const controller = new AbortController();
    void friendshipClient.list(controller.signal).then(setFriends).catch(() => undefined);
    return () => controller.abort();
  }, [isCreator]);

  const candidateVenues = useMemo(
    () => venues.filter((venue) => detail?.session.candidateVenueIds.includes(venue.id)),
    [venues, detail],
  );
  const uninvitedFriends = useMemo(() => {
    const memberIds = new Set(detail?.members.map((member) => member.userId) ?? []);
    return friends.filter((friend) => friend.status === "accepted" && !memberIds.has(friend.friendUserId));
  }, [detail, friends]);

  async function respondToInvitation(action: "accept" | "decline") {
    setResponding(true);
    setActionError(null);
    try {
      await groupSessionClient.respond(sessionId, action);
      if (action === "decline") {
        setDeclined(true);
        setDetail(null);
      } else {
        initializedPreferences.current = null;
        await loadSession();
      }
    } catch (error) {
      setActionError(errorMessage(error, "We couldn’t update this invitation."));
    } finally {
      setResponding(false);
    }
  }

  async function submitCheckIn() {
    setSubmitting(true);
    setActionError(null);
    try {
      const next = await groupSessionClient.updateMealPreferences(sessionId, preferenceState);
      setDetail(next);
      setFeedback("Your meal check-in is saved for this session.");
    } catch (error) {
      setActionError(errorMessage(error, "We couldn’t save your meal check-in."));
    } finally {
      setSubmitting(false);
    }
  }

  async function invite(userId: string) {
    setInvitingUserId(userId);
    setActionError(null);
    try {
      const next = await groupSessionClient.invite(sessionId, userId);
      setDetail(next);
      setFeedback("Invitation added. Share this session link with your friend.");
    } catch (error) {
      setActionError(errorMessage(error, "We couldn’t add that invitation."));
    } finally {
      setInvitingUserId(null);
    }
  }

  async function copyLink() {
    setActionError(null);
    setFeedback(null);
    let url: string;
    try {
      url = sessionInviteUrl(sessionId, window.location.origin, process.env.NEXT_PUBLIC_APP_URL);
      setShareUrl(url);
    } catch {
      setActionError("Open this meal on your published TasteDNA site to share a link that works on another device.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Session link copied. Send it to the friends you invited to this meal.");
    } catch {
      setActionError("Your browser couldn't copy the link. Select and copy the invite link below.");
    }
  }

  async function computeRecommendation() {
    setComputing(true);
    setActionError(null);
    try {
      const result = await groupSessionClient.compute(sessionId);
      setDetail((current) => current ? { ...current, latestRecommendation: result, session: { ...current.session, status: "revealed" } } : current);
      router.push(`/sessions/${sessionId}/results`);
    } catch (error) {
      setActionError(errorMessage(error, "We couldn’t compute the group recommendation."));
    } finally {
      setComputing(false);
    }
  }

  async function saveCandidates() {
    if (!editingCandidates || !isCandidateSetComplete(editingCandidates)) return;
    setSavingCandidates(true);
    setActionError(null);
    try {
      const next = await groupSessionClient.replaceCandidates(sessionId, editingCandidates);
      setDetail(next);
      setEditingCandidates(null);
      setFeedback("Candidate venues updated. Recompute to refresh the result.");
    } catch (error) {
      setActionError(errorMessage(error, "We couldn’t update candidate venues."));
    } finally {
      setSavingCandidates(false);
    }
  }

  function addIngredient() {
    if (!ingredientInput.trim()) return;
    setPreferenceState((current) => toggleExcludedIngredient(current, ingredientInput));
    setIngredientInput("");
  }

  if (status === "loading") {
    return <section className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--muted)]">Loading session…</section>;
  }

  if (status === "signed-out" || !user) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <Users className="mx-auto size-9 text-[var(--tomato)]" />
          <h1 className="mt-5 text-4xl">Sign in to join this session.</h1>
          <p className="mt-3 text-[var(--muted)]">Use the account that received the invitation.</p>
          <Link href={signInPath(`/sessions/${sessionId}`)} className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>Sign in</Link>
        </div>
      </section>
    );
  }

  if (declined) {
    return <section className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-4xl">Invitation declined.</h1><p className="mt-3 text-[var(--muted)]">You won’t receive session updates.</p><Link href="/friends" className={cn(buttonVariants(), "mt-7")}>Back to friends</Link></section>;
  }

  if (detail === undefined) {
    return <section className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--muted)]">Loading session…</section>;
  }

  if (detail === null) {
    let liveMealUrl: string | null = null;
    if (loadStatus === 503 && process.env.NEXT_PUBLIC_APP_URL) {
      try {
        const candidate = sessionInviteUrl(sessionId, "", process.env.NEXT_PUBLIC_APP_URL);
        if (typeof window !== "undefined" && new URL(candidate).origin !== window.location.origin) liveMealUrl = candidate;
      } catch { /* Keep the original retry path for invalid configuration. */ }
    }
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <h1 className="text-4xl">Session unavailable.</h1>
          <p role="alert" className="mt-3 text-[var(--muted)]">{liveMealUrl ? "This copy of TasteDNA can’t load shared meals. Continue on the live site." : loadError ?? "This session may be closed, or you may not have access."}</p>
          {liveMealUrl && <a href={liveMealUrl} className={cn(buttonVariants({ variant: "accent" }), "mt-5")}>Open this meal on the live site</a>}
          <p className="mt-4 text-sm text-[var(--muted)]">Signed in as {user.email}. Use the account the host invited, or ask them to add you to this meal.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Button onClick={() => void loadSession()}><RefreshCw className="size-4" /> Retry</Button><Link href={signInPath(`/sessions/${sessionId}`)} className={buttonVariants({ variant: "outline" })}>Switch account</Link><Link href="/sessions/new" className={buttonVariants({ variant: "outline" })}>Start a new one</Link></div>
        </div>
      </section>
    );
  }

  const myMember = detail.members.find((member) => member.userId === user.id);
  const invitationPending = myMember?.status === "invited";
  const canParticipate = myMember?.status === "joined" || myMember?.status === "responded";
  const iAmReady = myMember?.status === "responded";

  return (
    <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">GROUP SESSION</p><h1 className="mt-3 text-5xl sm:text-6xl">{detail.session.title}</h1></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void copyLink()}><Copy className="size-3.5" /> Copy link</Button><Button variant="ghost" size="sm" onClick={() => void loadSession()}><RefreshCw className="size-3.5" /> Refresh</Button></div>
      </div>

      {actionError && <p role="alert" className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {actionError}</p>}
      {feedback && <p role="status" className="mt-6 rounded-2xl bg-[#e5efe7] p-4 text-sm font-semibold text-[#315e4b]">{feedback}</p>}
      {shareUrl && <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-4"><label htmlFor="session-invite-link" className="text-sm font-bold">Session invite link</label><input id="session-invite-link" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm" /><p className="mt-2 text-xs text-[var(--muted)]">Only invited accounts can join. Your friend signs in, returns to this meal, then accepts.</p></div>}

      {invitationPending && (
        <section className="mt-8 rounded-[1.6rem] border border-[var(--tomato)]/30 bg-[#fff8f6] p-6">
          <h2 className="text-2xl">You’re invited.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Accept to see the roster, candidate venues, and add your meal preferences.</p>
          <div className="mt-5 flex gap-3"><Button disabled={responding} variant="accent" onClick={() => void respondToInvitation("accept")}><Check className="size-4" /> Accept</Button><Button disabled={responding} variant="outline" onClick={() => void respondToInvitation("decline")}><X className="size-4" /> Decline</Button></div>
        </section>
      )}

      <section className="mt-9">
        <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">WHO&rsquo;S IN</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.members.map((member) => {
            const copy = MEMBER_STATUS_COPY[member.status];
            const Icon = copy.icon;
            return <span key={member.userId} className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold">{member.displayName}<span className={cn("flex items-center gap-1 text-xs font-bold", copy.className)}><Icon className="size-3.5" /> {copy.label}</span></span>;
          })}
        </div>
      </section>

      {isCreator && uninvitedFriends.length > 0 && (
        <section className="mt-7 rounded-2xl border border-[var(--line)] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold"><UserPlus className="size-4 text-[var(--tomato)]" /> Invite another friend</h2>
          <div className="mt-3 flex flex-wrap gap-2">{uninvitedFriends.map((friend) => <Button key={friend.friendshipId} type="button" size="sm" variant="outline" disabled={invitingUserId !== null} onClick={() => void invite(friend.friendUserId)}>{invitingUserId === friend.friendUserId ? "Inviting…" : friend.friendDisplayName}</Button>)}</div>
        </section>
      )}

      {canParticipate && <GroupMedicationCard />}
      {canParticipate && detail.recommendationNeedsRefresh && <p role="status" className="mt-4 rounded-xl bg-[#fff8e7] p-4 text-sm text-[#71561d]">This meal needs a fresh check. A saved list, membership, or check coverage changed; recompute before choosing.</p>}

      {canParticipate && (
        <>
          <section className="mt-9">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">CANDIDATE VENUES</h2><p className="mt-1 text-xs text-[var(--muted)]">Only venues with a shared menu can be selected.</p></div>{isCreator && editingCandidates === null && <Button size="sm" variant="outline" onClick={() => setEditingCandidates(detail.session.candidateVenueIds)}>Change venues</Button>}</div>
            {venuesLoadState === "loading" ? <p className="mt-3 text-sm text-[var(--muted)]">Loading venues…</p> : editingCandidates ? (
              <div className="mt-4">
                {usingFallback && <p role="alert" className="mb-4 text-sm font-semibold text-[#71561d]">Supabase venues are unavailable, so candidates cannot be changed right now.</p>}
                <div className="grid max-h-[520px] gap-3 overflow-y-auto sm:grid-cols-2">{venues.map((venue) => <VenueCard key={venue.id} venue={venue} selected={editingCandidates.includes(venue.id)} onToggle={(id) => setEditingCandidates((current) => current ? toggleCandidate(current, id, venues) : current)} onHover={() => undefined} candidateDisabled={usingFallback} menuHref={!usingFallback && !isSelectable(venue) ? `/decode?venueId=${encodeURIComponent(venue.id)}&venueName=${encodeURIComponent(venue.name)}&returnTo=${encodeURIComponent(`/sessions/${sessionId}`)}` : undefined} />)}</div>
                <div className="mt-4 flex gap-3"><Button variant="accent" disabled={usingFallback || savingCandidates || !isCandidateSetComplete(editingCandidates)} onClick={() => void saveCandidates()}>{savingCandidates ? "Saving…" : "Save candidates"}</Button><Button variant="outline" disabled={savingCandidates} onClick={() => setEditingCandidates(null)}>Cancel</Button></div>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{candidateVenues.map((venue) => <Card key={venue.id}><CardContent className="p-4"><p className="font-bold">{venue.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{venue.location.label}</p><VenueIngredientDetails items={venue.menuItems} /></CardContent></Card>)}{candidateVenues.length < detail.session.candidateVenueIds.length && <p className="text-sm text-[var(--muted)]">Some venue details are temporarily unavailable.</p>}</div>
            )}
          </section>

          <section className="mt-10 rounded-[1.6rem] border border-[var(--line)] bg-white p-6">
            <h2 className="text-2xl">Your meal check-in</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--tomato)]"><Sparkles className="size-3.5" /> Temporary — for this meal only, never saved to your TasteDNA profile.</p>

            <div className="mt-6"><p className="text-sm font-bold">What sounds good today?</p><p className="mt-1 text-xs text-[var(--muted)]">Tap once to want it, tap again to avoid it.</p><div className="mt-3 flex flex-wrap gap-2">{MEAL_PREFERENCE_TAGS.map((tag) => { const preference = tagPreference(preferenceState, tag); return <button key={tag} type="button" aria-pressed={preference !== "neutral"} onClick={() => setPreferenceState((current) => cycleTagPreference(current, tag))} className={cn("rounded-full border px-4 py-2 text-sm font-semibold capitalize transition-all", preference === "desired" && "border-[#4b8a70] bg-[#e5efe7] text-[#315e4b]", preference === "avoided" && "border-[var(--tomato)] bg-[#fbe9e5] text-[var(--tomato)]", preference === "neutral" && "border-[var(--line)] bg-white")}>{tag}</button>; })}</div></div>

            <div className="mt-6"><p className="text-sm font-bold">Not today (protein)</p><div className="mt-3 flex flex-wrap gap-2">{PROTEIN_PRESETS.map((protein) => { const excluded = preferenceState.excludedProteinTypes.some((entry) => entry.toLowerCase() === protein.toLowerCase()); return <button key={protein} type="button" aria-pressed={excluded} onClick={() => setPreferenceState((current) => toggleExcludedProteinType(current, protein))} className={cn("rounded-full border px-4 py-2 text-sm font-semibold transition-all", excluded ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white")}>{protein}</button>; })}</div></div>

            <div className="mt-6"><p className="text-sm font-bold">Not today (ingredient)</p><div className="mt-3 flex gap-2"><input value={ingredientInput} onChange={(event) => setIngredientInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addIngredient(); } }} placeholder="e.g. cilantro" className="flex-1 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40" /><Button type="button" variant="outline" onClick={addIngredient}>Add</Button></div>{preferenceState.excludedIngredients.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{preferenceState.excludedIngredients.map((ingredient) => <button key={ingredient} type="button" onClick={() => setPreferenceState((current) => toggleExcludedIngredient(current, ingredient))} className="flex items-center gap-1.5 rounded-full bg-[var(--cream)] px-3 py-1.5 text-xs font-semibold">{ingredient} <X className="size-3" /></button>)}</div>}</div>

            <div className="mt-6 max-w-xs"><label htmlFor="max-price" className="text-sm font-bold">Price ceiling (optional)</label><input id="max-price" type="number" min={0.01} max={1000} value={preferenceState.maxPrice ?? ""} onChange={(event) => setPreferenceState((current) => setMaxPrice(current, event.target.value ? Number(event.target.value) : undefined))} placeholder="No limit" className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40" /></div>

            <Button type="button" size="lg" variant="accent" className="mt-8" disabled={submitting} onClick={() => void submitCheckIn()}>{submitting ? "Saving…" : iAmReady ? "Update my check-in" : "I’m ready"} <Check className="size-4" /></Button>
          </section>

          <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white p-5 sm:flex-row">
            <div><p className="font-bold">{detail.latestRecommendation ? "A group result is ready." : isCreator ? "Ready to choose fairly?" : "Waiting for the creator to reveal the pick."}</p><p className="mt-1 text-sm text-[var(--muted)]">{detail.latestRecommendation ? `Computed with ${detail.latestRecommendation.algorithmVersion}.` : "Results use saved taste profiles, current check-ins, shared menus, and each member’s opted-in medication list."}</p></div>
            {isCreator ? <Button size="lg" variant="accent" disabled={computing} onClick={() => void computeRecommendation()}>{computing ? "Computing…" : detail.latestRecommendation ? "Recompute result" : "Compute group result"} <Sparkles className="size-4" /></Button> : detail.latestRecommendation ? <Link href={`/sessions/${sessionId}/results`} className={buttonVariants({ size: "lg", variant: "accent" })}>View group result</Link> : null}
          </div>
        </>
      )}
    </div>
  );
}
