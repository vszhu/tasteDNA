"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronsUpDown, Info, RotateCcw, ScanLine, Sparkles } from "lucide-react";
import { MenuResultCard } from "@/components/recommendation/menu-result-card";
import { useTaste } from "@/components/providers/taste-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { rankMenuItems } from "@/lib/recommendation/scoring";
import { cn } from "@/lib/utils";

type SortMode = "match" | "menu" | "price";

export default function ResultsPage() {
  const { extractedMenu, profile, ratings, giveFeedback, loadDemo } = useTaste();
  const [sort, setSort] = useState<SortMode>("match");
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const ranked = useMemo(() => extractedMenu ? rankMenuItems(extractedMenu.items, profile) : [], [extractedMenu, profile]);
  const displayed = useMemo(() => [...ranked].sort((left, right) => {
    if (sort === "menu") return left.menuOrder - right.menuOrder;
    if (sort === "price") return (left.price ?? Number.POSITIVE_INFINITY) - (right.price ?? Number.POSITIVE_INFINITY);
    return left.rank - right.rank;
  }), [ranked, sort]);

  if (!extractedMenu) return <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-4 py-16 text-center"><div><div className="mx-auto grid size-20 place-items-center rounded-full bg-white shadow-lg"><ScanLine className="size-9 text-[var(--tomato)]" /></div><h1 className="mt-7 text-5xl">No menu decoded yet.</h1><p className="mt-4 leading-7 text-[var(--muted)]">Bring a menu photo or jump straight into the polished sample.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/decode" className={buttonVariants({ variant: "accent", size: "lg" })}>Decode a menu <ArrowRight className="size-4" /></Link><Button size="lg" variant="outline" onClick={loadDemo}>Load sample</Button></div></div></section>;

  const top = ranked[0];
  return (
    <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-14 lg:px-8">
      <Link href="/decode" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> Decode another menu</Link>
      <div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="flex flex-wrap items-center gap-2"><Badge className="text-[#497663]"><Sparkles className="mr-1 size-3" /> PERSONALIZED FOR YOU</Badge>{extractedMenu.usedFallback && <Badge className="text-[#82621f]">DEMO-SAFE MODE</Badge>}</div><h1 className="mt-4 text-5xl sm:text-6xl">Your menu, ranked.</h1><p className="mt-3 text-[var(--muted)]">{extractedMenu.menu.restaurantName ? `${extractedMenu.menu.restaurantName} · ` : ""}{extractedMenu.items.length} dishes · based on {profile.ratingCount} taste signals</p></div><div className="flex items-center gap-2"><ChevronsUpDown className="size-4 text-[var(--muted)]" /><label htmlFor="sort" className="sr-only">Sort results</label><select id="sort" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2"><option value="match">Taste Match</option><option value="menu">Menu order</option><option value="price">Price: low to high</option></select></div></div>

      {extractedMenu.notice && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4 text-sm text-[#71561d]"><Info className="mt-0.5 size-4 shrink-0" /> {extractedMenu.notice}</div>}
      {updateMessage && <div role="status" aria-live="polite" className="mt-6 flex items-center gap-3 rounded-2xl bg-[#e5efe7] p-4 text-sm font-semibold text-[#315e4b]"><CheckCircle2 className="size-4" /> {updateMessage}</div>}

      {top && <div className="relative mt-7 overflow-hidden rounded-[1.8rem] bg-[var(--ink)] p-6 text-white sm:p-8"><div className="absolute -right-12 -top-14 size-48 rounded-full border-[28px] border-white/5" /><p className="text-xs font-bold tracking-[.18em] text-[var(--saffron)]">THE SHORT ANSWER</p><div className="mt-3 flex items-end justify-between gap-6"><div><h2 className="text-3xl sm:text-4xl">Order the {top.dish.name}.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{top.explanation}</p></div><div className="hidden shrink-0 text-right sm:block"><span className="display text-6xl text-[var(--saffron)]">{top.score}</span><span className="text-sm">%</span></div></div></div>}

      <div className="mt-5 space-y-3">{displayed.map((recommendation) => {
        const feedback = ratings.find((rating) => rating.dishId === recommendation.dish.id)?.value;
        return <MenuResultCard key={recommendation.menuItemId} recommendation={recommendation} feedback={feedback} currency={extractedMenu.menu.currency} onFeedback={(liked) => { giveFeedback(recommendation.dish, liked); setUpdateMessage(liked ? `TasteDNA updated from your interest in ${recommendation.dish.name}. Rankings recalculated.` : `TasteDNA learned that ${recommendation.dish.name} isn’t for you. Rankings recalculated.`); window.setTimeout(() => setUpdateMessage(null), 4200); }} />;
      })}</div>

      <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white p-5 sm:flex-row"><div><p className="font-bold">Your profile just keeps learning.</p><p className="mt-1 text-sm text-[var(--muted)]">Feedback updates the profile and these scores immediately.</p></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setSort("match")}><RotateCcw className="size-3.5" /> Best match</Button><Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>See TasteDNA <ArrowRight className="size-3.5" /></Link></div></div>
    </div>
  );
}
