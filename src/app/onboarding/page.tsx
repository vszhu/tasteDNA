"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { useTaste } from "@/components/providers/taste-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { selectOnboardingDishes } from "@/lib/taste/active-learning";
import { ONBOARDING_TARGET } from "@/lib/taste/constants";
import { cn } from "@/lib/utils";
import type { Rating } from "@/types";

const ratingOptions: Array<{ value: Rating["value"]; emoji: string; label: string }> = [
  { value: 1, emoji: "😖", label: "No thanks" },
  { value: 2, emoji: "😕", label: "Not really" },
  { value: 3, emoji: "😐", label: "It’s okay" },
  { value: 4, emoji: "😋", label: "Like it" },
  { value: 5, emoji: "🤩", label: "Love it" },
];

export default function OnboardingPage() {
  const { ratings, rateDish, reset, dishes } = useTaste();
  const onboardingDishes = useMemo(() => selectOnboardingDishes(dishes.filter((dish) => dish.id.startsWith("seed-")), [], ONBOARDING_TARGET), [dishes]);
  const [index, setIndex] = useState(() => {
    const firstUnrated = onboardingDishes.findIndex((dish) => !ratings.some((rating) => rating.dishId === dish.id));
    return firstUnrated < 0 ? ONBOARDING_TARGET : firstUnrated;
  });
  const current = onboardingDishes[index];
  const currentRating = current ? ratings.find((rating) => rating.dishId === current.id)?.value : undefined;
  const completed = onboardingDishes.filter((dish) => ratings.some((rating) => rating.dishId === dish.id)).length;

  function select(value: Rating["value"]) {
    if (!current) return;
    rateDish(current.id, value);
    window.setTimeout(() => setIndex((valueIndex) => Math.min(valueIndex + 1, ONBOARDING_TARGET)), 160);
  }

  if (!current) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center px-4 py-16 text-center sm:px-6">
        <div className="w-full fade-up"><div className="mx-auto grid size-20 place-items-center rounded-full bg-[#dbe8d8] text-[#315e4b]"><Check className="size-9" /></div><p className="mt-7 text-xs font-bold tracking-[.18em] text-[var(--tomato)]">YOUR FIRST READ IS READY</p><h1 className="mt-3 text-5xl sm:text-6xl">That was deliciously easy.</h1><p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-[var(--muted)]">We found enough signal to map your strongest leanings. Your profile will keep getting sharper as you use it.</p><Link href="/dashboard" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-8")}>Reveal my TasteDNA <ArrowRight className="size-4" /></Link><button type="button" className="mx-auto mt-5 flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => { reset(); setIndex(0); }}><RotateCcw className="size-3.5" /> Start over</button></div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> Back</Link><span className="text-xs font-bold tracking-[.16em] text-[var(--muted)]">{completed} OF {ONBOARDING_TARGET}</span></div>
      <div role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={ONBOARDING_TARGET} aria-valuenow={completed} className="mt-5 h-1.5 overflow-hidden rounded-full bg-black/8"><div className="h-full rounded-full bg-[var(--tomato)] transition-all duration-500" style={{ width: `${(completed / ONBOARDING_TARGET) * 100}%` }} /></div>
      <div key={current.id} className="fade-up mx-auto mt-10 max-w-2xl text-center sm:mt-14">
        <p className="text-sm font-semibold text-[var(--tomato)]">How do you feel about…</p>
        <div className="float mx-auto mt-8 grid size-32 place-items-center rounded-[2.4rem] border border-white bg-white text-7xl shadow-[0_25px_55px_rgba(49,38,29,.12)] sm:size-40 sm:text-8xl">{current.imageHint}</div>
        <h1 className="mt-8 text-4xl sm:text-5xl">{current.name}</h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-[var(--muted)]">{current.description}</p>
        <div className="mt-9 grid grid-cols-5 gap-2 sm:gap-3">
          {ratingOptions.map((option) => <button key={option.value} type="button" onClick={() => select(option.value)} aria-label={`${option.value} stars: ${option.label}`} aria-pressed={currentRating === option.value} className={cn("group flex min-h-20 flex-col items-center justify-center rounded-2xl border bg-white p-2 transition-all hover:-translate-y-1 hover:border-[var(--tomato)] hover:shadow-lg sm:min-h-24", currentRating === option.value ? "border-[var(--tomato)] ring-2 ring-[var(--tomato)]/20" : "border-[var(--line)]")}><span className="text-2xl transition-transform group-hover:scale-110 sm:text-3xl">{option.emoji}</span><span className="mt-2 hidden text-[11px] font-semibold text-[var(--muted)] sm:block">{option.label}</span><span className="mt-1 text-[10px] font-bold text-[var(--muted)] sm:hidden">{option.value}</span></button>)}
        </div>
        <div className="mt-6 flex items-center justify-between"><Button variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ArrowLeft className="size-4" /> Previous</Button><p className="text-xs text-[var(--muted)]">Go with your gut.</p></div>
      </div>
    </section>
  );
}
