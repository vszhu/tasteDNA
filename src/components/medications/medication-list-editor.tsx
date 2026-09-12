"use client";

import { useState } from "react";
import { Check, Pill, Plus, Search, Trash2, X } from "lucide-react";
import { AccountMedicationSettings } from "./account-medication-settings";
import { useMedications } from "@/components/providers/medication-provider";
import { Button } from "@/components/ui/button";
import { MEDICATION_CATALOG, findMedication, medicationDisplayName } from "@/lib/medications/catalog";
import { MAX_MEDICATIONS, MAX_MEDICATION_NAME_LENGTH } from "@/lib/medications/storage";

export function MedicationListEditor() {
  const { medications, hydrated, saving, storageError, addMedication, removeMedication, clearMedications } = useMedications();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const matches = MEDICATION_CATALOG.filter((entry) => [entry.name, entry.form, ...entry.aliases].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const full = medications.length >= MAX_MEDICATIONS;
  function add(value: string) {
    addMedication(value);
    setQuery("");
    setMessage(`${medicationDisplayName(value)} added to your list.`);
  }
  return (
      <section aria-labelledby="medication-list-title" className="rounded-[1.8rem] border border-[var(--line)] bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[.18em] text-[var(--muted)]">01 · YOUR LIST</p><h2 id="medication-list-title" className="mt-2 text-3xl">What do you take?</h2></div><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e8eee8]"><Pill className="size-6" /></span></div>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choose the exact medicine and form on your label. Search {MEDICATION_CATALOG.length} medications with selected, source-backed food checks.</p>
        <label htmlFor="medication-search" className="mt-6 block text-sm font-bold">Search medication or brand</label>
        <div className="relative mt-2"><Search className="absolute left-4 top-3.5 size-4 text-[var(--muted)]" /><input id="medication-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={MAX_MEDICATION_NAME_LENGTH} placeholder="e.g. simvastatin or Allegra" className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--cream)] pl-11 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]" /></div>
        <p className="mt-3 text-xs text-[var(--muted)]">{matches.length} {matches.length === 1 ? "match" : "matches"} · select the form on your label</p>
        <div role="group" aria-label="Covered medication matches" className="mt-2 max-h-80 space-y-2 overflow-y-auto p-1">
          {matches.map((entry) => {
            const selected = medications.includes(entry.id);
            return <button key={entry.id} type="button" disabled={!hydrated || saving || full || selected} onClick={() => add(entry.id)} aria-label={`Add ${entry.name}, ${entry.form}`} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3.5 text-left transition-colors hover:bg-[var(--cream)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-55">
              <span><span className="text-sm font-bold">{entry.name}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{entry.form}</span></span>{selected ? <Check className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0" />}
            </button>;
          })}
          {matches.length === 0 && <p className="rounded-xl bg-[var(--cream)] p-4 text-sm leading-6 text-[var(--muted)]">No covered medication matches this search. You can keep it on your list as unverified.</p>}
          {query.trim() && !findMedication(query) && <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3" disabled={!hydrated || saving || full} onClick={() => add(query.trim())}><Plus className="size-4 shrink-0" /> Add “{query.trim()}” as unverified</Button>}
        </div>
        <div className="mt-6 border-t border-[var(--line)] pt-5">
          <div className="flex items-center justify-between"><p className="text-xs font-bold tracking-[.12em]">ADDED MEDICATIONS · {medications.length}</p>{medications.length > 0 && <button type="button" disabled={saving} onClick={() => { clearMedications(); setMessage("Tab list cleared. Save to update your account and group settings."); }} className="flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[var(--muted)] underline underline-offset-4"><Trash2 className="size-3" /> Clear list</button>}</div>
          {!hydrated ? <p className="mt-3 text-sm text-[var(--muted)]">Restoring your list…</p> : medications.length === 0 ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">No medications added. Your existing taste recommendations still work.</p> : <ul className="mt-3 space-y-2">{medications.map((entry) => <li key={entry} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--cream)] px-3 py-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{medicationDisplayName(entry)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{findMedication(entry) ? "Selected food-interaction rules available" : "Unverified · outside this reference"}</p></div><button type="button" disabled={saving} aria-label={`Remove ${medicationDisplayName(entry)}`} onClick={() => { removeMedication(entry); setMessage(`${medicationDisplayName(entry)} removed.`); }} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white focus-visible:outline-2"><X className="size-4" /></button></li>)}</ul>}
          {full && <p className="mt-3 text-xs text-[#71561d]">This prototype supports up to {MAX_MEDICATIONS} entries. Ask your pharmacist to review your complete list.</p>}
          <p role="status" aria-live="polite" className="mt-3 text-xs text-[var(--muted)]">{message}</p>
          {storageError && <p role="alert" className="mt-3 text-sm text-[#8c3327]">{storageError}</p>}
        </div>
        <AccountMedicationSettings />
      </section>
  );
}
