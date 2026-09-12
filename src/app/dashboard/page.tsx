"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ChefHat, Dna, Flame, RotateCcw, ScanLine, Sparkles } from "lucide-react";
import { ProfileRadar } from "@/components/taste/profile-radar";
import { MedicationSummary } from "@/components/medications/medication-summary";
import { useTaste } from "@/components/providers/taste-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, titleCase } from "@/lib/utils";

function EmptyProfile() {
  const { loadDemo } = useTaste();
  return <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-4 py-16 text-center"><div><div className="mx-auto grid size-20 place-items-center rounded-full bg-white shadow-lg"><Dna className="size-9 text-[var(--tomato)]" /></div><h1 className="mt-7 text-5xl">Let’s find your flavor.</h1><p className="mt-4 leading-7 text-[var(--muted)]">Your TasteDNA appears after a quick round of familiar food ratings.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/onboarding" className={buttonVariants({ variant: "accent", size: "lg" })}>Start rating <ArrowRight className="size-4" /></Link><Button size="lg" variant="outline" onClick={loadDemo}>Load demo profile</Button></div></div></section>;
}

export default function DashboardPage() {
  const { profile, dishes, reset } = useTaste();
  if (profile.ratingCount === 0) return <EmptyProfile />;
  const representative = profile.representativeDishIds.map((id) => dishes.find((dish) => dish.id === id)).filter(Boolean);
  const positives = profile.strongestPositiveFlavors.length ? profile.strongestPositiveFlavors : ["umami"];

  return (
    <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><Badge className="text-[#497663]"><Sparkles className="mr-1 size-3" /> {profile.confidence.toUpperCase()}</Badge><h1 className="mt-4 text-5xl sm:text-6xl">Your TasteDNA</h1><p className="mt-3 max-w-xl text-[var(--muted)]">A directional read from {profile.ratingCount} signals—not a label. Every reaction makes it more useful.</p></div>
        <Link href="/decode" className={cn(buttonVariants({ variant: "accent", size: "lg" }), "shrink-0")}>Decode a menu <ScanLine className="size-4" /></Link>
      </div>

      <MedicationSummary className="mt-7" />
      <div className="mt-9 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="overflow-hidden"><CardContent className="grid items-center gap-2 p-5 sm:grid-cols-[1fr_.8fr] sm:p-8"><div><p className="text-xs font-bold tracking-[.16em] text-[var(--muted)]">YOUR PALATE SHAPE</p><ProfileRadar profile={profile} /></div><div className="rounded-[1.3rem] bg-[var(--ink)] p-6 text-white"><Dna className="size-7 text-[var(--saffron)]" /><h2 className="mt-5 text-3xl">You chase {titleCase(positives[0])}.</h2><p className="mt-3 text-sm leading-6 text-white/65">Your strongest rated foods share {positives.slice(0, 3).map(titleCase).join(", ").toLowerCase()} cues. We’ll favor those signals without hiding interesting outliers.</p><div className="mt-6 border-t border-white/15 pt-5"><p className="text-[10px] font-bold tracking-[.16em] text-white/45">PROFILE CONFIDENCE</p><div className="mt-3 flex gap-1.5">{[0, 1, 2, 3, 4].map((segment) => <span key={segment} className={cn("h-1.5 flex-1 rounded-full", segment < Math.min(5, Math.ceil(profile.ratingCount / 4)) ? "bg-[var(--saffron)]" : "bg-white/15")} />)}</div></div></div></CardContent></Card>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Card><CardContent><div className="flex items-center justify-between"><p className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">TOP SIGNALS</p><Flame className="size-4 text-[var(--tomato)]" /></div><div className="mt-6 flex flex-wrap gap-2">{profile.strongestPositiveFlavors.map((item, index) => <span key={item} className={cn("rounded-full px-4 py-2 text-sm font-semibold", index === 0 ? "bg-[var(--tomato)] text-white" : "bg-[var(--cream)]")}>{titleCase(item)}</span>)}{profile.strongestNegativeFlavors.map((item) => <span key={item} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">Less {titleCase(item)}</span>)}</div></CardContent></Card>
          <Card><CardContent><div className="flex items-center justify-between"><p className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">FAVORITE CUISINES</p><ChefHat className="size-4 text-[var(--tomato)]" /></div><div className="mt-5 space-y-3">{(profile.favoriteCuisines.length ? profile.favoriteCuisines : ["Still learning"]).map((cuisine, index) => <div key={cuisine} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-[var(--cream)] text-xs font-bold">{index + 1}</span><span className="font-semibold">{titleCase(cuisine)}</span></div>)}</div></CardContent></Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">REPRESENTATIVE FAVORITES</p><h2 className="mt-2 text-2xl">Your flavor anchors</h2></div><BookOpen className="size-5 text-[var(--tomato)]" /></div><div className="mt-5 grid grid-cols-2 gap-3">{representative.map((dish) => dish && <div key={dish.id} className="rounded-2xl bg-[var(--cream)] p-4"><span className="text-3xl">{dish.imageHint ?? "🍽️"}</span><p className="mt-3 text-sm font-bold leading-snug">{dish.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{dish.cuisine}</p></div>)}</div></CardContent></Card>
        <Card className="bg-[#e9dfca]"><CardContent><p className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">COOKING & TEXTURE</p><h2 className="mt-2 text-2xl">How you like it made</h2><div className="mt-5 space-y-3">{[...profile.favoriteTextures.map(titleCase), ...profile.preferredCookingStyles.map(titleCase)].slice(0, 5).map((value, index) => <div key={value} className="flex items-center gap-3"><span className="h-2.5 rounded-full bg-[var(--ink)]" style={{ width: `${Math.max(18, 44 - index * 6)}%` }} /><span className="shrink-0 text-sm font-semibold">{value}</span></div>)}</div><p className="mt-7 text-xs leading-5 text-[var(--muted)]">These are correlations in your ratings, not rules. A great dish can still surprise you.</p></CardContent></Card>
      </div>

      <div className="mt-7 flex justify-center"><Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="size-3.5" /> Reset local profile</Button></div>
    </div>
  );
}
