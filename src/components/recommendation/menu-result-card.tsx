"use client";

import { useState } from "react";
import { ChevronDown, CircleMinus, Heart, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Recommendation, Rating } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import { canShortlist, type MedicationCheck } from "@/lib/medications/check";
import { MedicationCheckDetails, MedicationStatusBadge } from "@/components/medications/medication-status";

function matchStyle(score: number) {
  if (score >= 78) return { label: "Excellent match", shell: "border-[#b7d0c1]", score: "bg-[#245b48] text-white", bar: "bg-[#4b8a70]" };
  if (score >= 58) return { label: "Good match", shell: "border-[#e7d29f]", score: "bg-[var(--saffron)] text-[var(--ink)]", bar: "bg-[var(--saffron)]" };
  return { label: "Taste stretch", shell: "border-[var(--line)]", score: "bg-[#ece8df] text-[var(--ink)]", bar: "bg-[#a9a69e]" };
}

export function MenuResultCard({ recommendation, medicationCheck, feedback, currency, onFeedback }: {
  recommendation: Recommendation;
  medicationCheck?: MedicationCheck;
  feedback?: Rating["value"];
  currency: string;
  onFeedback: (liked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = matchStyle(recommendation.score);
  const isTopPick = recommendation.rank === 1 && (!medicationCheck || canShortlist(medicationCheck));
  const scorePosition = Math.max(4, Math.min(96, recommendation.score));
  return (
    <article className={cn("overflow-hidden rounded-[1.4rem] border bg-white shadow-[0_10px_35px_rgba(45,37,31,.045)] transition-all duration-500", style.shell)}>
      <button type="button" className="w-full p-4 text-left sm:p-5" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <div className="flex items-start gap-3 sm:gap-5">
          <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--cream)] text-xs font-bold text-[var(--muted)]">{String(recommendation.rank).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl leading-tight sm:text-2xl">{recommendation.dish.name}</h2>{isTopPick && <Badge className="text-[var(--tomato)]"><Heart className="mr-1 size-3 fill-current" /> {medicationCheck ? "TASTE SHORTLIST" : "TOP PICK"}</Badge>}</div><p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{recommendation.dish.description}</p>{medicationCheck && <div className="mt-3"><MedicationStatusBadge status={medicationCheck.status} /></div>}</div><div className={cn("grid size-16 shrink-0 place-items-center rounded-full sm:size-[4.5rem]", style.score)}><div className="text-center"><span className="display text-3xl leading-none">{recommendation.score}</span>{medicationCheck ? <span className="block text-[9px] font-bold">TASTE / 100</span> : <span className="text-[10px] font-bold">%</span>}</div></div></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">{recommendation.positiveFactors.slice(0, 3).map((factor) => <span key={factor} className="rounded-full bg-[#e8f0e9] px-2.5 py-1 text-[11px] font-semibold text-[#315e4b]">+ {factor}</span>)}{recommendation.negativeFactors.slice(0, 1).map((factor) => <span key={factor} className="rounded-full bg-[#f2ede5] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">– {factor}</span>)}{recommendation.price != null && <span className="ml-auto text-sm font-bold">{formatPrice(recommendation.price, currency)}</span>}</div>
            <div className="relative mt-4 h-1.5 rounded-full bg-black/7"><span className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", style.bar)} style={{ width: `${scorePosition}%` }} /></div>
          </div>
          <ChevronDown className={cn("mt-6 hidden size-4 shrink-0 text-[var(--muted)] transition-transform sm:block", expanded && "rotate-180")} />
        </div>
      </button>
      {medicationCheck && <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5"><MedicationCheckDetails check={medicationCheck} compact /></div>}
      {expanded && <div className="border-t border-[var(--line)] bg-[#fcfaf5] px-4 py-5 sm:px-8 sm:py-6"><div className="grid gap-6 md:grid-cols-[1fr_.7fr]"><div><p className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">WHY IT LANDED HERE</p><p className="mt-3 leading-7">{recommendation.explanation}</p><div className="mt-5 flex flex-wrap gap-2">{recommendation.dish.ingredients.slice(0, 8).map((ingredient) => <span key={ingredient} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium">{ingredient}</span>)}</div>{recommendation.dish.features.unknownFields?.length ? <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]"><CircleMinus className="size-3.5" /> Some details were uncertain: {recommendation.dish.features.unknownFields.join(", ")}.</p> : null}</div><div className="rounded-2xl border border-[var(--line)] bg-white p-4"><p className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">SCORE BREAKDOWN</p><div className="mt-4 space-y-4">{[["Food similarity", recommendation.semanticScore], ["Trait compatibility", recommendation.structuredScore]].map(([label, raw]) => { const value = Math.round((Number(raw) + 1) * 50); return <div key={String(label)}><div className="flex justify-between text-xs font-semibold"><span>{label}</span><span>{value}</span></div><div className="mt-1.5 h-1.5 rounded bg-black/7"><div className="h-full rounded bg-[var(--ink)]" style={{ width: `${value}%` }} /></div></div>; })}</div><p className="mt-4 text-[10px] leading-4 text-[var(--muted)]">Final match = 70% food similarity + 30% interpretable traits.</p></div></div></div>}
      <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3 sm:justify-end sm:px-5"><span className="mr-auto hidden text-xs text-[var(--muted)] sm:block">{medicationCheck ? "Rate flavor only · warnings stay in place" : "Help your TasteDNA learn"}</span><Button variant={feedback === 1 ? "default" : "ghost"} size="sm" aria-pressed={feedback === 1} onClick={() => onFeedback(false)}><ThumbsDown className={cn("size-3.5", feedback === 1 && "fill-current")} /> {medicationCheck ? "Not my taste" : "Not for me"}</Button><Button variant={feedback === 5 ? "accent" : "outline"} size="sm" aria-pressed={feedback === 5} onClick={() => onFeedback(true)}><ThumbsUp className={cn("size-3.5", feedback === 5 && "fill-current")} /> {medicationCheck ? "Like this flavor" : "I’d order this"}</Button></div>
    </article>
  );
}
