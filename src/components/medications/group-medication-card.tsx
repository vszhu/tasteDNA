"use client";

import Link from "next/link";
import { ArrowUpRight, LockKeyhole, Users } from "lucide-react";
import { useMedications } from "@/components/providers/medication-provider";

/** Shows only the current account's saved state, never a friend's private list. */
export function GroupMedicationCard() {
  const { hydrated, savedAccount, hasUnsavedChanges, accountError } = useMedications();
  const connected = savedAccount?.use_in_groups;
  return <section aria-label="Medication checks for your circle" className="mt-6 rounded-2xl border border-[#d5dcd8] bg-[#eef2ec] p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-bold tracking-[.08em]"><Users className="size-4" /> MEDICINE → MENU → YOUR CIRCLE</p><h2 className="mt-2 text-2xl">A meal that considers each of you.</h2></div><LockKeyhole className="size-5 shrink-0 text-[#315e4b]" /></div>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Each member can connect their own private account list. When the group chooses a meal, dishes needing medication review are held back for that person.</p>
    <p role="status" className="mt-3 text-xs font-semibold">{!hydrated ? "Checking your saved settings…" : accountError ? "Your saved settings could not be verified. Open your list to review them." : connected ? `Your saved list is connected${hasUnsavedChanges ? "; tab edits still need saving" : ""}.` : "Your group medication checks are off. Connect them from your list."}</p>
    <Link href="/medications/settings" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold underline underline-offset-4">Manage my medication settings<ArrowUpRight className="size-4" /></Link>
  </section>;
}
