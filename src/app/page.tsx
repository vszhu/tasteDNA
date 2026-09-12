"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Dna, ScanLine, Sparkles, Star } from "lucide-react";
import { BrandMark } from "@/components/brand/mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTaste } from "@/components/providers/taste-provider";
import { cn } from "@/lib/utils";

const steps = [
  { icon: Star, number: "01", title: "Rate what you know", copy: "A dozen familiar foods. No quizzes, no foodie vocabulary." },
  { icon: Dna, number: "02", title: "We learn your palate", copy: "Flavor, texture and cuisine signals become your living TasteDNA." },
  { icon: ScanLine, number: "03", title: "Decode any menu", copy: "Snap a menu. See every dish ranked for you, with reasons." },
];

function TasteConstellation() {
  const labels = [
    { label: "UMAMI", value: "92", className: "left-[14%] top-[16%] bg-[#1d4539] text-white" },
    { label: "SPICY", value: "84", className: "right-[8%] top-[35%] bg-[var(--tomato)] text-white" },
    { label: "FRESH", value: "76", className: "bottom-[8%] left-[24%] bg-[#dce7d8]" },
    { label: "CRISPY", value: "81", className: "bottom-[15%] right-[18%] bg-[#f4d99e]" },
  ];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[390px] rounded-full border border-[var(--line)] bg-white/40 p-8">
      <div className="absolute inset-[14%] rounded-full border border-dashed border-[var(--ink)]/20" />
      <div className="absolute inset-[28%] rounded-full border border-[var(--ink)]/10" />
      <div className="absolute inset-[38%] grid place-items-center rounded-full bg-white shadow-xl">
        <BrandMark className="size-12" />
      </div>
      {labels.map((item) => <div key={item.label} className={cn("absolute grid size-20 place-items-center rounded-full text-center shadow-lg sm:size-24", item.className)}><div><div className="text-2xl font-bold leading-none">{item.value}</div><div className="mt-1 text-[10px] font-bold tracking-[.16em]">{item.label}</div></div></div>)}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { loadDemo } = useTaste();

  return (
    <div className="overflow-hidden">
      <section className="noise relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:px-8 lg:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-[.92fr_1.08fr]">
          <div className="fade-up relative z-10">
            <Badge className="mb-5 text-[var(--tomato)]"><Sparkles className="mr-1 size-3" /> PERSONAL, NOT POPULAR</Badge>
            <h1 className="max-w-[680px] text-5xl leading-[.94] sm:text-6xl lg:text-[5.4rem]">Your palate,<br /><span className="italic text-[var(--tomato)]">decoded.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">TasteDNA learns what you love, then turns any restaurant menu into a personalized shortlist.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/onboarding" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "group")}>Discover My Taste <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
              <Button size="lg" variant="outline" onClick={() => { loadDemo(); router.push("/dashboard"); }}>Try the instant demo</Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><Check className="size-3.5 text-[#4e866d]" /> No sign-up. About 90 seconds.</p>
          </div>
          <div className="fade-up-delay relative lg:-mr-24">
            <div className="absolute -left-5 top-10 z-10 rounded-2xl bg-white p-3 shadow-xl sm:-left-8 sm:p-4">
              <p className="text-[10px] font-bold tracking-[.14em] text-[var(--muted)]">TASTE MATCH</p>
              <p className="display text-4xl text-[var(--tomato)]">94<span className="text-lg">%</span></p>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2.2rem] border-[7px] border-white shadow-[0_35px_90px_rgba(46,36,25,.2)]">
              <Image src="/hero-feast.png" alt="A table of globally diverse dishes" fill priority sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-6 pt-20 text-white">
                <p className="text-xs font-semibold tracking-[.14em]">TONIGHT’S SIGNAL</p>
                <p className="display mt-1 text-2xl">Spicy · savory · bright</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--ink)] px-4 py-20 text-white sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-xl"><p className="text-xs font-bold tracking-[.2em] text-[#a8c4b6]">HOW IT WORKS</p><h2 className="mt-3 text-4xl sm:text-5xl">From “I like it” to<br />“I know what to order.”</h2></div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[1.8rem] bg-white/15 md:grid-cols-3">
            {steps.map(({ icon: Icon, number, title, copy }) => <article key={number} className="group bg-[var(--ink)] p-7 transition-colors hover:bg-[#21493d] sm:p-9"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[.18em] text-white/45">{number}</span><Icon className="size-5 text-[var(--saffron)]" /></div><h3 className="mt-16 text-2xl">{title}</h3><p className="mt-3 leading-7 text-white/62">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
        <TasteConstellation />
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-[var(--tomato)]">A PROFILE THAT FEELS LIKE YOU</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">More than a list of likes.</h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[var(--muted)]">Your profile blends the meaning of the foods you rate with understandable signals like heat, richness, freshness and crunch. It evolves every time you react.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm font-semibold"><div className="rounded-2xl border border-[var(--line)] bg-white p-4">46 starter dishes</div><div className="rounded-2xl border border-[var(--line)] bg-white p-4">12 taste dimensions</div><div className="rounded-2xl border border-[var(--line)] bg-white p-4">Explainable scores</div><div className="rounded-2xl border border-[var(--line)] bg-white p-4">Learns from feedback</div></div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--paper)] px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-5xl text-center"><p className="text-xs font-bold tracking-[.2em] text-[var(--tomato)]">ONE MENU, YOUR ORDER</p><h2 className="mt-3 text-4xl sm:text-5xl">Seven dishes become one clear answer.</h2></div>
        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {[
            ["01", "Miso Butter Ramen", "Umami · spicy · noodle-based", "94"],
            ["02", "Crispy Maitake Tacos", "Crispy · tangy · chile-forward", "89"],
            ["03", "Charred Harissa Chicken", "Smoky · bright · spicy", "85"],
          ].map(([rank, name, reason, score]) => <div key={name} className="flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 text-left shadow-sm sm:p-5"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--cream)] text-xs font-bold">{rank}</span><div className="min-w-0 flex-1"><h3 className="truncate text-lg sm:text-xl">{name}</h3><p className="mt-1 truncate text-sm text-[var(--muted)]">{reason}</p></div><div className="text-right"><span className="display text-3xl text-[var(--tomato)]">{score}</span><span className="text-xs">%</span></div></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="relative overflow-hidden rounded-[2rem] bg-[var(--tomato)] px-6 py-14 text-center text-white sm:px-12 sm:py-20"><div className="absolute -left-12 -top-16 size-48 rounded-full border-[28px] border-white/10" /><div className="absolute -bottom-20 -right-8 size-64 rounded-full border-[36px] border-white/10" /><h2 className="relative text-4xl sm:text-6xl">Meet your next favorite dish.</h2><p className="relative mx-auto mt-4 max-w-xl text-white/75">Twelve quick ratings. A whole new way to read a menu.</p><Link href="/onboarding" className={cn(buttonVariants({ size: "lg" }), "relative mt-8 bg-white text-[var(--ink)] hover:bg-[var(--cream)]")}>Discover My Taste <ArrowRight className="size-4" /></Link></div>
      </section>
    </div>
  );
}
