"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, FlaskConical, LockKeyhole, Network, Pill, Plus, ScanLine, SlidersHorizontal, Utensils, X } from "lucide-react";
import { useMedications } from "@/components/providers/medication-provider";
import { useTaste } from "@/components/providers/taste-provider";
import { InteractionExplorer } from "@/components/medications/interaction-explorer";
import { MedicationListEditor } from "@/components/medications/medication-list-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { MEDICATION_CATALOG, MEDICATION_SOURCES_CHECKED, findMedication } from "@/lib/medications/catalog";
import { createMedicationDemoMenu } from "@/lib/medications/demo";
import { rankMedicationAwareMenu, unavailableMenuReason } from "@/lib/medications/check";
import { cn } from "@/lib/utils";

type WorkspaceMode = "auto" | "personal" | "example";

export default function MedicationsPage() {
  const { medications, hydrated, storageError } = useMedications();
  const { profile, extractedMenu, setExtractedMenu, hydrated: tasteHydrated } = useTaste();
  const [mode, setMode] = useState<WorkspaceMode>("auto");
  const [editorOpen, setEditorOpen] = useState(false);
  const [exampleMedications, setExampleMedications] = useState(["simvastatin", "fexofenadine", "linezolid"]);
  const exampleMenu = useMemo(() => createMedicationDemoMenu(), []);
  const example = mode === "example" || (mode === "auto" && !extractedMenu);
  const menu = example ? exampleMenu : extractedMenu;
  const selections = example ? exampleMedications : medications;
  const recommendations = useMemo(() => menu ? rankMedicationAwareMenu(menu, profile, selections) : [], [menu, profile, selections]);
  const unsupported = medications.filter((entry) => !findMedication(entry));
  const unavailableReason = menu ? unavailableMenuReason(menu) : undefined;

  function useExampleMenu() {
    setExtractedMenu(exampleMenu);
    setMode("personal");
  }

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
      <div><p className="flex items-center gap-2 text-[10px] font-bold tracking-[.22em] text-[var(--tomato)]"><Network className="size-4" /> FOOD × MEDICINE</p><h1 className="mt-3 text-[2.6rem] leading-[1.05] sm:text-5xl">See the <span className="italic text-[var(--tomato)]">connection.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Your medications, the ingredients on the menu, and the food you love. Connected in one place.</p></div>
      <Link href="/decode" className={cn(buttonVariants({ variant: "accent" }), "w-fit shrink-0")}><ScanLine className="size-4" /> Decode a menu<ArrowRight className="size-4" /></Link>
    </div>

    <section aria-label="Your medication list" className="mt-5 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9eee7]"><Pill className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold">Your medication list <span className="ml-1 text-xs font-medium text-[var(--muted)]">/ {medications.length} added</span></p><p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{!hydrated ? "Restoring your list…" : medications.length ? medications.map((entry) => findMedication(entry)?.name ?? entry).join(" · ") : "Add your exact medicine and form to connect your own menu."}</p></div><Button variant="outline" size="sm" aria-expanded={editorOpen} aria-controls="medication-editor" onClick={() => setEditorOpen(!editorOpen)} className="shrink-0 px-3"><SlidersHorizontal className="size-3.5" /><span className="hidden sm:inline">{editorOpen ? "Close list" : "Manage list"}</span><span className="sm:hidden">{editorOpen ? "Close" : "Edit"}</span></Button></div>
      {unsupported.length > 0 && <p className="mt-3 rounded-lg bg-[#fff8e7] p-3 text-xs leading-5 text-[#71561d]">{unsupported.join(", ")} {unsupported.length === 1 ? "is" : "are"} outside this reference. Your menu will stay in review.</p>}
      {storageError && <p role="alert" className="mt-3 text-sm leading-6 text-[#8c3327]">{storageError}</p>}
    </section>
    {editorOpen && <div id="medication-editor" className="mt-3"><MedicationListEditor /></div>}

    <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Menu workspace" className="inline-flex rounded-full border border-[var(--line)] bg-[#eee9de] p-1">
        <button type="button" aria-pressed={!example} onClick={() => setMode("personal")} className={cn("flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-bold transition-colors", !example ? "bg-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]")}><Utensils className="size-3.5" />My menu</button>
        <button type="button" aria-pressed={example} onClick={() => setMode("example")} className={cn("flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-bold transition-colors", example ? "bg-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]")}><FlaskConical className="size-3.5" />Example lab</button>
      </div>
      <p className="text-[11px] text-[var(--muted)]">{menu ? `${menu.items.length} dishes · ${profile.ratingCount} taste signals` : "Ready for your next menu"}</p>
    </div>

    {example && <section aria-label="Example medications" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#dfcfaa] bg-[#f0e7d4] p-3 sm:px-4">
      <div className="mr-auto"><p className="text-[9px] font-bold tracking-[.1em] text-[#796036]">EXAMPLE LAB · NOT YOUR LIST</p><p className="mt-1 text-[11px] text-[#796b55]">Choose from {MEDICATION_CATALOG.length} medicines to redraw connections.</p></div>
      <div role="group" aria-label="Choose example medicines" className="grid max-h-52 w-full grid-cols-1 gap-2 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-4">{MEDICATION_CATALOG.map((entry) => {
        const selected = exampleMedications.includes(entry.id);
        return <button key={entry.id} type="button" aria-label={`Example ${entry.name}, ${entry.form}`} aria-pressed={selected} onClick={() => setExampleMedications((current) => selected ? current.filter((id) => id !== entry.id) : [...current, entry.id])} className={cn("flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2", selected ? "border-[#18372e] bg-[#18372e] text-white" : "border-[#d6c8ad] bg-white/55 text-[#645842]")}><span>{selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}</span><span className="font-semibold">{entry.name}<span className={cn("mt-0.5 block text-[9px] font-normal", selected ? "text-white/65" : "text-[#796b55]")}>{entry.form}</span></span></button>;
      })}</div>
      <button type="button" onClick={useExampleMenu} disabled={!tasteHydrated || !hydrated} aria-label="Use this menu with my list" className="flex min-h-9 items-center gap-2 px-1 text-[11px] font-bold underline underline-offset-4 disabled:opacity-50">Use menu<ArrowRight className="size-3.5" /></button>
    </section>}

    {!hydrated || !tasteHydrated ? <div role="status" className="rounded-2xl border border-[var(--line)] p-10 text-sm text-[var(--muted)]">Connecting your menu and preferences…</div> : !example && storageError ? <div className="rounded-2xl border border-[#edc1b6] bg-[#fff1ec] p-6"><h2 className="text-2xl">Review your medication list first.</h2><p className="mt-3 text-sm leading-6">Your list could not be reliably saved or restored. Open Manage list to correct it before using your menu checks.</p></div> : menu ? <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1"><p className="text-xs font-semibold">{menu.menu.restaurantName ?? "Your decoded menu"}</p>{!example && <Link href="/results" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--tomato)]">Full taste rankings<ArrowRight className="size-3.5" /></Link>}</div>
      {!example && !medications.length && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#e6ece4] p-4 text-sm"><span>Menu connected. Add your medications to start the food checks.</span><Button size="sm" onClick={() => setEditorOpen(true)}><Plus className="size-3.5" /> Add medications</Button></div>}
      {unavailableReason && <p role="alert" className="mb-4 rounded-xl bg-[#fff1ec] p-4 text-sm leading-6 text-[#8c3327]">{unavailableReason} <Link href="/decode" className="font-bold underline">Paste menu text.</Link></p>}
      {!example && menu.usedFallback && <p className="mb-4 text-xs leading-5 text-[var(--muted)]">{menu.menu.sourceType === "demo" ? "Example dishes · not a verified restaurant menu. Checks use your own medication list." : menu.menu.sourceType === "text" ? "Read with the local text parser. Confirm ingredient details with the restaurant." : "Sample dishes shown; your photo has not been read."}</p>}
      <InteractionExplorer key={`${example ? "example" : "personal"}:${menu.menu.id}`} recommendations={recommendations} medications={selections} currency={menu.menu.currency} tasteSignals={profile.ratingCount} example={example} />
    </> : <div className="grid items-center gap-8 rounded-[1.8rem] border border-[var(--line)] bg-[var(--paper)] p-7 sm:p-12 md:grid-cols-[1fr_.8fr]">
      <div><p className="text-[10px] font-bold tracking-[.15em] text-[var(--tomato)]">NEXT CONNECTION / YOUR MENU</p><h2 className="mt-3 text-4xl">Bring the menu.<br />Find the connections.</h2><p className="mt-4 text-sm leading-7 text-[var(--muted)]">Decode a menu to connect its dishes with your medication list and taste profile.</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/decode" className={buttonVariants({ variant: "accent" })}>Decode a menu<ArrowRight className="size-4" /></Link><Button variant="outline" onClick={useExampleMenu}>Use example dishes</Button></div></div>
      <div className="flex items-center justify-center gap-3 rounded-3xl bg-[#e9eee7] px-4 py-14" aria-hidden="true">{[Pill, Network, ScanLine].map((Icon, index) => <span key={index} className="flex items-center gap-3"><span className="grid size-14 place-items-center rounded-2xl bg-white shadow-sm"><Icon className="size-6 text-[var(--ink)]" /></span>{index < 2 && <span className="w-5 border-t border-dashed border-[#7f9585]" />}</span>)}</div>
    </div>}

    <div className="mt-6 grid gap-4 text-[11px] leading-6 text-[var(--muted)] sm:grid-cols-[1fr_1.8fr]">
      <p className="flex items-start gap-2"><LockKeyhole className="mt-1 size-3.5 shrink-0" /><span>Save your list privately to your account and choose whether to use it in group meals. Friends see dish guidance, never medication names. Lists are never sent to AI.</span></p>
      <p>Selected food rules for {MEDICATION_CATALOG.length} medications. This map does not assess every interaction, dose, timing, allergy, or condition. Taste scores are preferences, not safety scores. Confirm food questions with your pharmacist and restaurant.</p>
    </div>
    <details className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold"><BookOpen className="size-4" /> The reference behind the map<span className="ml-auto text-[10px] font-medium text-[var(--muted)]">{MEDICATION_CATALOG.length} medications</span><ChevronDown className="size-3.5" /></summary><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{MEDICATION_CATALOG.map((entry) => <div key={entry.id} className="rounded-xl bg-[var(--cream)] p-4"><p className="text-sm font-bold">{entry.name}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{entry.form}</p><p className="mt-3 text-xs leading-6 text-[var(--muted)]">{entry.summary}</p>{entry.rules.map((rule) => <a key={rule.id} href={rule.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-[11px] font-semibold underline underline-offset-4">{rule.source.title} — {rule.source.section}<span className="sr-only"> (opens a new tab)</span></a>)}</div>)}</div><p className="mt-4 text-[10px] text-[var(--muted)]">Sources checked {MEDICATION_SOURCES_CHECKED}.</p></details>
    {editorOpen && <button type="button" onClick={() => setEditorOpen(false)} className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--muted)]"><X className="size-3.5" /> Close medication editor</button>}
  </div>;
}
