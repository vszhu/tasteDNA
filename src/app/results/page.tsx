"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronsUpDown, Info, List, Network, RotateCcw, ScanLine, Sparkles } from "lucide-react";
import { MenuResultCard } from "@/components/recommendation/menu-result-card";
import { useTaste } from "@/components/providers/taste-provider";
import { useMedications } from "@/components/providers/medication-provider";
import { InteractionExplorer } from "@/components/medications/interaction-explorer";
import { MedicationSummary } from "@/components/medications/medication-summary";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { canShortlist, rankMedicationAwareMenu, sortMedicationRecommendations, unavailableMenuReason } from "@/lib/medications/check";
import { cn } from "@/lib/utils";
import { createMedicationDemoMenu } from "@/lib/medications/demo";

type SortMode = "match" | "menu" | "price";
const ANALYZE_STARTED_AT_KEY = "tastedna-analyze-started-at";

function rankWithTiming(...input: Parameters<typeof rankMedicationAwareMenu>) {
  const started = performance.now();
  const items = rankMedicationAwareMenu(...input);
  return { items, durationMs: performance.now() - started };
}

export default function ResultsPage() {
  const { extractedMenu, profile, ratings, giveFeedback, setExtractedMenu, hydrated: tasteHydrated } = useTaste();
  const { medications, hydrated: medicationsHydrated, storageError } = useMedications();
  const medicationMode = medications.length > 0 || Boolean(storageError);
  const [view, setView] = useState<"map" | "list">("map");
  const showMap = medicationMode && view === "map";
  const [sort, setSort] = useState<SortMode>("match");
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const ranking = useMemo(
    () => extractedMenu ? rankWithTiming(extractedMenu, profile, medications) : { items: [], durationMs: 0 },
    [extractedMenu, profile, medications],
  );
  const ranked = ranking.items;
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !extractedMenu) return;
    console.info("[TasteDNA timing] local ranking", {
      durationMs: Math.round(ranking.durationMs * 100) / 100,
      dishes: extractedMenu.items.length,
    });
    const analyzeStartedAt = Number(sessionStorage.getItem(ANALYZE_STARTED_AT_KEY));
    if (Number.isFinite(analyzeStartedAt) && analyzeStartedAt > 0) {
      console.info("[TasteDNA timing] total Analyze Menu", {
        durationMs: Date.now() - analyzeStartedAt,
        dishes: extractedMenu.items.length,
      });
      sessionStorage.removeItem(ANALYZE_STARTED_AT_KEY);
    }
  }, [extractedMenu, ranking]);
  const displayed = useMemo(() => sortMedicationRecommendations(ranked, sort), [ranked, sort]);

  if (!tasteHydrated || !medicationsHydrated) return <div role="status" className="mx-auto max-w-6xl px-6 py-16 text-[var(--muted)]">Restoring your menu and preferences…</div>;

  if (storageError) return <section className="mx-auto max-w-xl px-6 py-16"><h1 className="text-4xl">Review your medication list.</h1><p role="alert" className="mt-4 text-sm leading-7 text-[var(--muted)]">{storageError}</p><Link href="/medications" className={cn(buttonVariants(), "mt-6")}>Manage medication list<ArrowRight className="size-4" /></Link></section>;

  if (!extractedMenu) return <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-4 py-16 text-center"><div><div className="mx-auto grid size-20 place-items-center rounded-full bg-white shadow-lg"><ScanLine className="size-9 text-[var(--tomato)]" /></div><h1 className="mt-7 text-5xl">No menu decoded yet.</h1><p className="mt-4 leading-7 text-[var(--muted)]">Bring a menu photo or jump straight into the polished sample.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/decode" className={buttonVariants({ variant: "accent", size: "lg" })}>Decode a menu <ArrowRight className="size-4" /></Link><Button size="lg" variant="outline" onClick={() => setExtractedMenu(createMedicationDemoMenu())}>Load sample</Button></div></div></section>;

  const top = medicationMode ? ranked.find((item) => canShortlist(item.medicationCheck)) : ranked[0];
  const unavailableReason = unavailableMenuReason(extractedMenu);
  return (
    <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-14 lg:px-8">
      <Link href="/decode" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> Decode another menu</Link>
      <div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="flex flex-wrap items-center gap-2"><Badge className="text-[#497663]"><Sparkles className="mr-1 size-3" /> PERSONALIZED FOR YOU</Badge>{extractedMenu.usedFallback && <Badge className="text-[#82621f]">{extractedMenu.menu.sourceType === "demo" ? "EXAMPLE MENU" : extractedMenu.menu.sourceType === "image" ? "SAMPLE · PHOTO NOT READ" : "LOCAL TEXT PARSER"}</Badge>}</div><h1 className="mt-4 text-5xl sm:text-6xl">Your menu, ranked.</h1><p className="mt-3 text-[var(--muted)]">{extractedMenu.menu.restaurantName ? `${extractedMenu.menu.restaurantName} · ` : ""}{extractedMenu.items.length} dishes · based on {profile.ratingCount} taste signals</p></div>{!showMap && <div className="flex items-center gap-2"><ChevronsUpDown className="size-4 text-[var(--muted)]" /><label htmlFor="sort" className="sr-only">Sort results</label><select id="sort" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2"><option value="match">Taste Match</option><option value="menu">Menu order</option><option value="price">Price: low to high</option></select></div>}</div>

      <MedicationSummary className="mt-6" />
      {medicationMode && <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">Food checks first. Taste scores stay the same.</p>
        <div role="group" aria-label="Results view" className="flex rounded-full border border-[var(--line)] bg-white p-1">
          <button type="button" aria-pressed={showMap} onClick={() => setView("map")} className={cn("flex min-h-9 items-center gap-2 rounded-full px-4 text-xs font-bold", showMap ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]")}><Network className="size-3.5" />Connection map</button>
          <button type="button" aria-pressed={!showMap} onClick={() => setView("list")} className={cn("flex min-h-9 items-center gap-2 rounded-full px-4 text-xs font-bold", !showMap ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]")}><List className="size-3.5" />Ranked list</button>
        </div>
      </div>}
      {unavailableReason && medicationMode && <div role="alert" className="mt-5 rounded-2xl border border-[#edc1b6] bg-[#fff1ec] p-4 text-sm leading-6 text-[#8c3327]">{unavailableReason} <Link href="/decode" className="font-bold underline">Paste your menu text to check it.</Link></div>}
      {extractedMenu.notice && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4 text-sm text-[#71561d]"><Info className="mt-0.5 size-4 shrink-0" /> {extractedMenu.notice}</div>}
      {updateMessage && <div role="status" aria-live="polite" className="mt-6 flex items-center gap-3 rounded-2xl bg-[#e5efe7] p-4 text-sm font-semibold text-[#315e4b]"><CheckCircle2 className="size-4" /> {updateMessage}</div>}

      {showMap ? <div className="mt-5"><InteractionExplorer recommendations={ranked} medications={medications} currency={extractedMenu.menu.currency} tasteSignals={profile.ratingCount} /></div> : <>
      {top ? <div className="relative mt-7 overflow-hidden rounded-[1.8rem] bg-[var(--ink)] p-6 text-white sm:p-8"><div className="absolute -right-12 -top-14 size-48 rounded-full border-[28px] border-white/5" /><p className="text-xs font-bold tracking-[.18em] text-[var(--saffron)]">{medicationMode ? "A DISH TO ASK ABOUT" : "THE SHORT ANSWER"}</p><div className="mt-3 flex items-end justify-between gap-6"><div><h2 className="text-3xl sm:text-4xl">{medicationMode ? `Consider the ${top.dish.name}.` : `Order the ${top.dish.name}.`}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">{top.explanation}</p>{medicationMode && <p className="mt-3 text-sm leading-6 text-white/75">No covered interaction matched its extracted text. Confirm ingredients before ordering.</p>}</div><div className="hidden shrink-0 text-right sm:block"><span className="display text-6xl text-[var(--saffron)]">{top.score}</span><span className="text-sm">{medicationMode ? "/100" : "%"}</span>{medicationMode && <p className="mt-1 text-xs text-white/70">Taste match</p>}</div></div></div> : medicationMode && <div className="mt-7 rounded-[1.8rem] bg-[var(--ink)] p-6 text-white sm:p-8"><p className="text-xs font-bold tracking-[.18em] text-[var(--saffron)]">NO SHORTLIST YET</p><h2 className="mt-3 text-3xl">Review this menu before choosing.</h2><p className="mt-3 text-sm leading-6 text-white/75">{unavailableReason ? "Your photo has not been read. Paste its text or configure live menu reading to continue." : "Every dish needs review, or your medication list has a gap in coverage. Read the findings below and ask your pharmacist and the restaurant for the missing details."}</p></div>}

      <div className="mt-5 space-y-3">{displayed.map((recommendation) => {
        const feedback = ratings.find((rating) => rating.dishId === recommendation.dish.id)?.value;
        return <MenuResultCard key={recommendation.menuItemId} recommendation={recommendation} medicationCheck={medicationMode ? recommendation.medicationCheck : undefined} feedback={feedback} currency={extractedMenu.menu.currency} onFeedback={(liked) => { giveFeedback(recommendation.dish, liked); setUpdateMessage(liked ? `TasteDNA updated from your interest in ${recommendation.dish.name}. Rankings recalculated.` : `TasteDNA learned that ${recommendation.dish.name} isn’t for you. Rankings recalculated.`); window.setTimeout(() => setUpdateMessage(null), 4200); }} />;
      })}</div>

      </>}

      <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white p-5 sm:flex-row"><div><p className="font-bold">Your profile just keeps learning.</p><p className="mt-1 text-sm text-[var(--muted)]">Feedback updates the profile and these scores immediately.</p></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => { setSort("match"); setView("list"); }}><RotateCcw className="size-3.5" /> {showMap ? "Rate these dishes" : "Best match"}</Button><Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>See TasteDNA <ArrowRight className="size-3.5" /></Link></div></div>
    </div>
  );
}
