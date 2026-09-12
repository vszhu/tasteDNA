"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Circle, Focus, Leaf, Network, Pill, RotateCcw, Utensils } from "lucide-react";
import { MedicationCheckDetails, MedicationStatusBadge } from "./medication-status";
import { findMedication } from "@/lib/medications/catalog";
import { MEDICATION_STATUS_COPY, type MedicationRecommendation, type MedicationCheckStatus } from "@/lib/medications/check";
import { buildMedicationMap, dishesForNode, dishNodeId, menuAlternatives, pathsForNode } from "@/lib/medications/map";
import { cn, formatPrice } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All dishes" },
  { id: "avoid", label: "Label warnings" },
  { id: "review", label: "Needs review" },
  { id: "no-listed-match", label: "No listed match" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];
const PAGE_SIZE = 6;
const attentionOrder: Record<MedicationCheckStatus, number> = { avoid: 0, review: 1, "no-listed-match": 2, "not-checked": 3 };

function statusColor(status: MedicationCheckStatus) {
  return status === "avoid" ? "#ff9d80" : status === "review" ? "#eac36c" : "#c1d0c7";
}

export function InteractionExplorer({ recommendations, medications, currency, tasteSignals, example = false }: {
  recommendations: MedicationRecommendation[];
  medications: string[];
  currency: string;
  tasteSignals: number;
  example?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const inspectorRef = useRef<HTMLElement>(null);
  const map = useMemo(() => buildMedicationMap(recommendations, medications), [recommendations, medications]);
  const selected = map.nodes.find((node) => node.id === selectedId) ?? null;
  const focusedPaths = pathsForNode(map, selected?.id ?? null);
  const relatedIds = new Set(focusedPaths.flatMap((path) => [path.medicationId, path.ingredientId, path.dishId]));
  const scoped = dishesForNode(map, recommendations, selected?.id ?? null);
  const filtered = scoped.filter((item) => filter === "all" || item.medicationCheck.status === filter)
    .sort((a, b) => attentionOrder[a.medicationCheck.status] - attentionOrder[b.medicationCheck.status] || a.rank - b.rank);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleDishes = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const visibleDishIds = new Set(visibleDishes.map((dish) => dishNodeId(dish.menuItemId)));
  const visiblePaths = focusedPaths.filter((path) => visibleDishIds.has(path.dishId));
  const visibleTermIds = new Set(visiblePaths.map((path) => path.ingredientId));
  const medicineNodes = map.nodes.filter((node) => node.kind === "medication");
  const dishOrder = new Map(visibleDishes.map((dish, index) => [dishNodeId(dish.menuItemId), index]));
  function termOrder(id: string) {
    const paths = visiblePaths.filter((path) => path.ingredientId === id);
    return paths.reduce((sum, path) => sum + (dishOrder.get(path.dishId) ?? 0), 0) / paths.length;
  }
  const termNodes = map.nodes.filter((node) => node.kind === "ingredient" && visibleTermIds.has(node.id)).sort((a, b) => termOrder(a.id) - termOrder(b.id));
  const dishNodes = visibleDishes.map((dish) => map.nodes.find((node) => node.id === dishNodeId(dish.menuItemId))!);
  const graphHeight = Math.max(410, Math.max(medicineNodes.length, termNodes.length, dishNodes.length) * 68 + 80);
  const positions = new Map<string, number>();
  for (const column of [medicineNodes, termNodes, dishNodes]) column.forEach((node, index) => positions.set(node.id, 58 + (index + 0.5) * (graphHeight - 86) / column.length));
  const selectedDish = selected?.kind === "dish" ? recommendations.find((item) => dishNodeId(item.menuItemId) === selected.id) : undefined;
  const inspected = selectedDish ?? (!selected ? filtered.find((item) => item.medicationCheck.findings.length > 0) ?? filtered[0] : undefined);
  const alternatives = menuAlternatives(recommendations, inspected?.menuItemId);
  const connectedDishes = new Set(map.paths.map((path) => path.dishId)).size;

  function selectNode(id: string) {
    const next = selected?.id === id ? null : id;
    setSelectedId(next);
    setFilter("all");
    const index = [...recommendations].sort((a, b) => attentionOrder[a.medicationCheck.status] - attentionOrder[b.medicationCheck.status] || a.rank - b.rank).findIndex((item) => dishNodeId(item.menuItemId) === next);
    setPage(index >= 0 ? Math.floor(index / PAGE_SIZE) : 0);
    if (next && window.matchMedia?.("(max-width: 767px)").matches) {
      requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    }
  }

  return <section aria-label={example ? "Example food and medication explorer" : "Your food and medication explorer"} className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-[var(--paper)] shadow-[0_14px_60px_#18372e08]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2.5"><Network className="size-4 text-[var(--tomato)]" /><h2 className="font-sans text-sm font-bold tracking-normal">Food & medicine map</h2><span className="rounded-full bg-[#e9eee7] px-2 py-1 text-[10px] font-bold">{connectedDishes} connected dishes</span></div>
      <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><Focus className="size-3.5" /> Tap a node. Follow the connection.</span>
    </div>

    <div className="grid xl:grid-cols-[minmax(0,1fr)_310px]">
      <div className="min-w-0 border-b border-[var(--line)] xl:border-b-0 xl:border-r">
        <div className="flex flex-wrap gap-1.5 p-4" aria-label="Filter mapped dishes">
          {FILTERS.map(({ id, label }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setPage(0); if (selected?.kind === "dish") setSelectedId(null); }} className={cn("flex min-h-9 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2", filter === id ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--ink)]")}>
            {label}{" "}<span className={cn("text-[10px]", filter === id ? "text-white/65" : "text-[var(--muted)]")}>{scoped.filter((item) => id === "all" || item.medicationCheck.status === id).length}</span>
          </button>)}
        </div>

        <div className="relative bg-[#163e33] text-white">
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-white/10 px-5 py-2">
            <p role="status" className="truncate text-xs text-white/75">{selected ? `Tracing ${selected.label}` : "Every line starts with a matched food reference."}</p>
            {selected && <button type="button" onClick={() => { setSelectedId(null); setPage(0); }} className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/20 px-2.5 text-[10px] font-semibold focus-visible:outline-2"><RotateCcw className="size-3" /> Show all</button>}
          </div>

          <div className="hidden max-h-[500px] overflow-auto md:block" role="region" aria-label="Interactive connection diagram" tabIndex={0}>
            <div className="relative min-w-[640px]" style={{ height: graphHeight, backgroundImage: "radial-gradient(#ffffff15 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
              <div className="absolute inset-x-0 top-5 grid grid-cols-[28%_36%_36%] text-center text-[9px] font-semibold tracking-[.2em] text-white/55"><span>01 / MEDICINE</span><span>02 / FOOD TERM</span><span>03 / ON THE MENU</span></div>
              <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 800 ${graphHeight}`} preserveAspectRatio="none">
                {visiblePaths.map((path) => {
                  const y1 = positions.get(path.medicationId)!;
                  const y2 = positions.get(path.ingredientId)!;
                  const y3 = positions.get(path.dishId)!;
                  return <g key={path.id} fill="none" stroke={statusColor(path.severity)} strokeWidth={selected ? 2.2 : 1.5} opacity={selected ? 0.85 : 0.5} strokeDasharray={path.evidence === "menu-text" ? undefined : "5 5"}>
                    <path d={`M208 ${y1} C260 ${y1}, 260 ${y2}, 312 ${y2}`} />
                    <path d={`M480 ${y2} C516 ${y2}, 516 ${y3}, 552 ${y3}`} />
                  </g>;
                })}
              </svg>
              {[medicineNodes, termNodes, dishNodes].map((column, columnIndex) => column.map((node) => {
                const Icon = node.kind === "medication" ? Pill : node.kind === "ingredient" ? Leaf : Utensils;
                const active = selected?.id === node.id;
                const dimmed = selected && !relatedIds.has(node.id) && !active;
                return <button key={node.id} type="button" aria-label={`${node.kind === "ingredient" ? "Food term" : node.kind === "dish" ? "Dish" : "Medicine"}: ${node.label}`} aria-pressed={active} onClick={() => selectNode(node.id)} title={`${node.label} · ${node.detail} · ${MEDICATION_STATUS_COPY[node.status]}`} className={cn("absolute flex min-h-[52px] -translate-y-1/2 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white", node.kind === "medication" ? "border-[#f6f3e8] bg-[#f6f3e8] text-[#18372e]" : node.kind === "ingredient" ? "border-[#d0b77f] bg-[#e9d8ae] text-[#413b23]" : "border-[#658276] bg-[#244e40] text-white", active && "ring-2 ring-[#edbd63] ring-offset-4 ring-offset-[#163e33]", dimmed && "opacity-35")} style={{ left: ["2%", "39%", "69%"][columnIndex], width: ["24%", "21%", "29%"][columnIndex], top: positions.get(node.id) }}>
                  <Icon className="size-3.5 shrink-0 opacity-70" /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold capitalize">{node.label}</span><span className="mt-0.5 block truncate text-[9px] opacity-65">{node.kind === "medication" ? node.detail : node.kind === "ingredient" ? "Tap to trace" : node.detail}</span></span>
                  {node.kind === "dish" && <span className="size-1.5 shrink-0 rounded-full" style={{ background: statusColor(node.status) }} />}
                </button>;
              }))}
              {medicineNodes.length === 0 && <p className="absolute left-[3%] top-[42%] w-[23%] text-center text-xs leading-6 text-white/65">Add your medications to draw connections.</p>}
              {termNodes.length === 0 && <div className="absolute left-[38%] top-[40%] w-[25%] text-center"><Circle className="mx-auto size-8 text-white/25" /><p className="mt-3 text-xs leading-5 text-white/60">{medications.length ? "No mapped food terms in this view." : "Food connections will appear here."}</p></div>}
              {dishNodes.length === 0 && <p className="absolute left-[70%] top-[43%] w-[27%] text-center text-xs leading-6 text-white/65">No dishes in this view.<br />Try another filter or show all.</p>}
            </div>
          </div>

          <div className="space-y-4 p-4 md:hidden" role="region" aria-label="Mobile connection cards">
            <p className="text-[10px] font-bold tracking-[.15em] text-white/55">TAP A MEDICINE TO TRACE</p>
            <div className="flex flex-wrap gap-2">{medicineNodes.map((node) => <button key={node.id} type="button" aria-pressed={selected?.id === node.id} aria-label={`Medicine: ${node.label}`} onClick={() => selectNode(node.id)} className={cn("flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold", selected?.id === node.id ? "border-[#edbd63] bg-[#edbd63] text-[var(--ink)]" : "border-white/25 bg-white/10")}><Pill className="size-3.5" />{node.label}</button>)}{medicineNodes.length === 0 && <p className="text-xs text-white/65">Add medications to draw connections.</p>}</div>
            {visibleDishes.map((item) => {
              const terms = [...new Set(visiblePaths.filter((path) => path.dishId === dishNodeId(item.menuItemId)).map((path) => map.nodes.find((node) => node.id === path.ingredientId)!.label))];
              return <button key={item.menuItemId} type="button" aria-label={`Dish: ${item.dish.name}`} aria-pressed={selected?.id === dishNodeId(item.menuItemId)} onClick={() => selectNode(dishNodeId(item.menuItemId))} className={cn("block w-full rounded-xl border p-3.5 text-left", selected?.id === dishNodeId(item.menuItemId) ? "border-[#edbd63] bg-white/10" : "border-white/15 bg-white/5")}>
                {terms.length > 0 && <span className="mb-3 flex items-center gap-2 text-[11px] text-[#edcc8b]"><Leaf className="size-3.5 shrink-0" />{terms.join(" · ")}<ArrowDown className="ml-auto size-3.5 shrink-0" /></span>}
                <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{item.dish.name}</span><span className="text-xs text-white/60">{item.score}/100</span></span><span className="mt-1.5 block text-[10px]" style={{ color: statusColor(item.medicationCheck.status) }}>{MEDICATION_STATUS_COPY[item.medicationCheck.status]}</span>
              </button>;
            })}
            {visibleDishes.length === 0 && <p className="py-8 text-center text-sm text-white/65">No dishes in this view. Try another filter or show all.</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-[10px] text-white/70">
            <div className="flex flex-wrap gap-3"><span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#ff9d80]" />Label warning</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#eac36c]" />Review</span><span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-white/70" />Inferred / optional</span></div>
            <div className="flex items-center gap-2"><span>{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)}` : "0"} of {filtered.length} dishes</span><button type="button" aria-label="Previous map dishes" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="grid size-8 place-items-center rounded-full border border-white/20 disabled:opacity-25"><ChevronLeft className="size-3.5" /></button><button type="button" aria-label="Next map dishes" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} className="grid size-8 place-items-center rounded-full border border-white/20 disabled:opacity-25"><ChevronRight className="size-3.5" /></button></div>
          </div>
        </div>
        <p className="px-5 py-3 text-[11px] leading-5 text-[var(--muted)]">Lines connect matched terms, not confirmed ingredients. No line does not mean no interaction. {example && "Example medicines are separate from your list."}</p>
      </div>

      <aside ref={inspectorRef} aria-label="Connection details" className="min-w-0 scroll-mt-24 p-5 sm:p-6">
        {inspected ? <>
          <p className="flex items-center justify-between text-[10px] font-bold tracking-[.14em] text-[var(--muted)]"><span>{selectedDish ? "DISH IN FOCUS" : "START HERE"}</span><ArrowUpRight className="size-4" /></p>
          <h3 className="mt-3 text-3xl leading-tight">{inspected.dish.name}</h3>
          <div className="mt-3"><MedicationStatusBadge status={inspected.medicationCheck.status} /></div>
          <div className="mt-5 flex items-center gap-3 border-y border-[var(--line)] py-3"><span className="display text-3xl">{inspected.score}<span className="font-sans text-xs text-[var(--muted)]">/100</span></span><span className="text-[10px] leading-4 text-[var(--muted)]">Taste match<br />{tasteSignals ? `${tasteSignals} taste signals` : "Rate dishes to personalize"}</span>{inspected.price != null && <span className="ml-auto text-sm font-semibold">{formatPrice(inspected.price, currency)}</span>}</div>
          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">{inspected.dish.description}</p>
          <div className="mt-4"><MedicationCheckDetails check={inspected.medicationCheck} compact /></div>
          {inspected.tasteRank !== inspected.rank && <p className="mt-4 rounded-xl bg-[#ede9de] px-3 py-2 text-[11px] leading-5">Taste rank <strong>#{inspected.tasteRank}</strong> → review order <strong>#{inspected.rank}</strong>. Its taste score stays the same.</p>}
        </> : selected ? <>
          <p className="text-[10px] font-bold tracking-[.14em] text-[var(--muted)]">{selected.kind === "medication" ? "MEDICINE IN FOCUS" : "FOOD TERM IN FOCUS"}</p>
          <h3 className="mt-3 break-words text-3xl capitalize">{selected.label}</h3><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{selected.detail}</p>
          <p className="mt-5 text-sm leading-6">{selected.kind === "medication" ? findMedication(selected.id.slice("medication:".length))?.summary ?? "This medication is outside the reference. Its interactions have not been checked; ask your pharmacist." : "This term matched a covered reference. Select a dish to see its evidence and the question to ask."}</p>
          <p className="mt-6 text-[10px] font-bold tracking-[.14em] text-[var(--muted)]">{scoped.length} CONNECTED DISHES</p>
          <div className="mt-3 space-y-2">{scoped.map((item) => <button key={item.menuItemId} type="button" onClick={() => selectNode(dishNodeId(item.menuItemId))} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3 text-left text-xs font-semibold hover:bg-[var(--cream)]"><span>{item.dish.name}</span><ArrowRight className="size-3.5 shrink-0" /></button>)}</div>
          {!scoped.length && <p className="mt-3 text-xs leading-6 text-[var(--muted)]">No connection is shown in this reference. Other interactions and ingredient details remain unverified.</p>}
        </> : <div className="py-10 text-center"><Network className="mx-auto size-8 text-[var(--sage)]" /><h3 className="mt-4 text-2xl">Explore a connection.</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Tap a medicine, food term, or dish to inspect it.</p></div>}
      </aside>
    </div>

    <div className="border-t border-[var(--line)] bg-[#eeeee4] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-bold tracking-[.15em] text-[var(--muted)]"><Utensils className="size-3.5" /> KEEP YOUR TASTE IN THE PICTURE</p><h3 className="mt-2 text-2xl">Other dishes to explore</h3></div><span className="text-[11px] text-[var(--muted)]">No listed match · ingredients still need confirmation</span></div>
      {alternatives.length ? <div className="mt-4 grid gap-3 md:grid-cols-3">{alternatives.map((item) => <button key={item.menuItemId} type="button" aria-label={`Explore ${item.dish.name}, ${item.score} out of 100 taste match`} onClick={() => selectNode(dishNodeId(item.menuItemId))} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 text-left transition-colors hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2"><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.dish.name}</span><span className="mt-1.5 block text-[10px] text-[var(--muted)]">{item.positiveFactors.slice(0, 2).join(" · ") || "Rate dishes to tune your taste match"}</span><span className="mt-2 block text-xs font-semibold">{item.score}/100 taste{item.price != null && ` · ${formatPrice(item.price, currency)}`}</span></span><ArrowUpRight className="size-4 shrink-0 text-[var(--muted)] group-hover:text-[var(--tomato)]" /></button>)}</div> : <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{medications.length ? "No dishes qualify for this shortlist. Review the findings and coverage gaps before choosing." : "Add your medication list to compare dishes with the covered food checks."}</p>}
      {!tasteSignals && <Link href="/onboarding" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--tomato)]">Teach TasteDNA your preferences<ArrowRight className="size-3.5" /></Link>}
    </div>
  </section>;
}
