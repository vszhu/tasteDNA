"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, Clock, Sparkles, Users, X } from "lucide-react";
import { useVenues } from "@/components/map/use-venues";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cycleTagPreference, EMPTY_MEAL_PREFERENCE_STATE, setMaxPrice, tagPreference, toggleExcludedIngredient, toggleExcludedProteinType } from "@/lib/session/meal-preferences";
import { mockSessionAdapter, SELF_USER_ID, type StoredSession } from "@/lib/session/mock-session-adapter";
import { MEAL_PREFERENCE_TAGS } from "@/types/group";
import type { DiningSessionMember } from "@/types/group";
import { cn } from "@/lib/utils";

const PROTEIN_PRESETS = ["Chicken", "Beef", "Pork", "Shellfish", "Fish", "Tofu", "Dairy"];

const MEMBER_STATUS_COPY: Record<DiningSessionMember["status"], { label: string; icon: typeof Check; className: string }> = {
  invited: { label: "Invited", icon: Clock, className: "text-[var(--muted)]" },
  joined: { label: "Joined", icon: Users, className: "text-[var(--muted)]" },
  responded: { label: "Ready", icon: Check, className: "text-[#315e4b]" },
  declined: { label: "Declined", icon: X, className: "text-[var(--muted)]" },
};

export default function SessionRoomPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const { user, status } = useSession();
  const { venues, loadState: venuesLoadState } = useVenues();
  const [stored, setStored] = useState<StoredSession | null | undefined>(undefined);
  const [preferenceState, setPreferenceState] = useState(EMPTY_MEAL_PREFERENCE_STATE);
  const [ingredientInput, setIngredientInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mockSessionAdapter.getSession(sessionId).then((session) => {
      setStored(session);
      const mine = session?.members.find((member) => member.userId === SELF_USER_ID);
      if (mine) setPreferenceState(mine.mealPreferenceState);
    });
  }, [sessionId]);

  const candidateVenues = useMemo(() => venues.filter((venue) => stored?.session.candidateVenueIds.includes(venue.id)), [venues, stored]);

  async function submitCheckIn() {
    if (!stored) return;
    setSubmitting(true);
    const members = await mockSessionAdapter.submitMealPreferences(sessionId, SELF_USER_ID, preferenceState);
    setStored({ ...stored, members });
    setSubmitting(false);
  }

  function addIngredient() {
    if (!ingredientInput.trim()) return;
    setPreferenceState((current) => toggleExcludedIngredient(current, ingredientInput));
    setIngredientInput("");
  }

  if (status === "signed-out" || !user) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <Users className="mx-auto size-9 text-[var(--tomato)]" />
          <h1 className="mt-5 text-4xl">Sign in to join this session.</h1>
          <Link href="/sign-in" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>Sign in</Link>
        </div>
      </section>
    );
  }

  if (stored === undefined || status === "loading") {
    return <section className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--muted)]">Loading session…</section>;
  }

  if (stored === null) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <h1 className="text-4xl">Session not found.</h1>
          <p className="mt-3 text-[var(--muted)]">This session may have been cancelled or the link is wrong.</p>
          <Link href="/sessions/new" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>Start a new one</Link>
        </div>
      </section>
    );
  }

  const myMember = stored.members.find((member) => member.userId === SELF_USER_ID);
  const iAmReady = myMember?.status === "responded";

  return (
    <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6 sm:py-14">
      <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">GROUP SESSION</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">{stored.session.title}</h1>

      <section className="mt-9">
        <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">WHO&rsquo;S IN</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {stored.members.map((member) => {
            const copy = MEMBER_STATUS_COPY[member.status];
            const Icon = copy.icon;
            return (
              <span key={member.userId} className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold">
                {member.displayName}
                <span className={cn("flex items-center gap-1 text-xs font-bold", copy.className)}><Icon className="size-3.5" /> {copy.label}</span>
              </span>
            );
          })}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">CANDIDATE VENUES</h2>
        {venuesLoadState === "loading" ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Loading venues…</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {candidateVenues.map((venue) => (
              <Card key={venue.id}><CardContent className="p-4"><p className="font-bold">{venue.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{venue.location.label}</p></CardContent></Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-[1.6rem] border border-[var(--line)] bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl">Your meal check-in</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--tomato)]"><Sparkles className="size-3.5" /> Temporary — for this meal only, never saved to your TasteDNA profile.</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-bold">What sounds good today?</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Tap once to want it, tap again to avoid it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MEAL_PREFERENCE_TAGS.map((tag) => {
              const preference = tagPreference(preferenceState, tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={preference !== "neutral"}
                  onClick={() => setPreferenceState((current) => cycleTagPreference(current, tag))}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold capitalize transition-all",
                    preference === "desired" && "border-[#4b8a70] bg-[#e5efe7] text-[#315e4b]",
                    preference === "avoided" && "border-[var(--tomato)] bg-[#fbe9e5] text-[var(--tomato)]",
                    preference === "neutral" && "border-[var(--line)] bg-white",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-bold">Not today (protein)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PROTEIN_PRESETS.map((protein) => {
              const excluded = preferenceState.excludedProteinTypes.some((entry) => entry.toLowerCase() === protein.toLowerCase());
              return (
                <button
                  key={protein}
                  type="button"
                  aria-pressed={excluded}
                  onClick={() => setPreferenceState((current) => toggleExcludedProteinType(current, protein))}
                  className={cn("rounded-full border px-4 py-2 text-sm font-semibold transition-all", excluded ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white")}
                >
                  {protein}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-bold">Not today (ingredient)</p>
          <div className="mt-3 flex gap-2">
            <input
              value={ingredientInput}
              onChange={(event) => setIngredientInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addIngredient(); } }}
              placeholder="e.g. cilantro"
              className="flex-1 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
            />
            <Button type="button" variant="outline" onClick={addIngredient}>Add</Button>
          </div>
          {preferenceState.excludedIngredients.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {preferenceState.excludedIngredients.map((ingredient) => (
                <button key={ingredient} type="button" onClick={() => setPreferenceState((current) => toggleExcludedIngredient(current, ingredient))} className="flex items-center gap-1.5 rounded-full bg-[var(--cream)] px-3 py-1.5 text-xs font-semibold">
                  {ingredient} <X className="size-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 max-w-xs">
          <label htmlFor="max-price" className="text-sm font-bold">Price ceiling (optional)</label>
          <input
            id="max-price"
            type="number"
            min={0}
            value={preferenceState.maxPrice ?? ""}
            onChange={(event) => setPreferenceState((current) => setMaxPrice(current, event.target.value ? Number(event.target.value) : undefined))}
            placeholder="No limit"
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
          />
        </div>

        <Button type="button" size="lg" variant="accent" className="mt-8" disabled={submitting} onClick={submitCheckIn}>
          {submitting ? "Saving…" : iAmReady ? "Update my check-in" : "I’m ready"} <Check className="size-4" />
        </Button>
      </section>

      <div className="mt-6 text-center">
        <Link href={`/sessions/${sessionId}/results`} className="text-sm font-semibold text-[var(--tomato)] hover:underline">
          Preview how results would look →
        </Link>
      </div>
    </div>
  );
}
