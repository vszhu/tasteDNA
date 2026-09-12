"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Network } from "lucide-react";
import { useMedications } from "@/components/providers/medication-provider";
import { useTaste } from "@/components/providers/taste-provider";
import { findMedication } from "@/lib/medications/catalog";
import { rankMedicationAwareMenu } from "@/lib/medications/check";
import { cn } from "@/lib/utils";

export function MedicationSummary({ className }: { className?: string }) {
  const { medications, hydrated, storageError } = useMedications();
  const { extractedMenu, profile, hydrated: tasteHydrated } = useTaste();
  const checked = hydrated && tasteHydrated && !storageError && medications.length > 0 && Boolean(extractedMenu);
  const ranked = useMemo(() => checked && extractedMenu ? rankMedicationAwareMenu(extractedMenu, profile, medications) : [], [checked, extractedMenu, profile, medications]);
  const warnings = ranked.filter((item) => item.medicationCheck.status === "avoid").length;
  const reviews = ranked.filter((item) => item.medicationCheck.status === "review").length;
  const notChecked = ranked.filter((item) => item.medicationCheck.status === "not-checked").length;
  return <aside aria-label="Medication checks" className={cn("overflow-hidden rounded-2xl border border-[var(--line)] bg-white", className)}>
    <Link href="/medications" className="group flex items-center gap-3 p-4 transition-colors hover:bg-[#f4f5ee] sm:gap-4 sm:px-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e9eee7]"><Network className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">Your food & medicine map</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{!hydrated || !tasteHydrated ? "Connecting your preferences…" : medications.length ? medications.map((value) => findMedication(value)?.name ?? value).join(" · ") : "Connect your medication list to the menu and your taste profile."}</p>
        {checked && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold"><span>{ranked.length} menu dishes</span>{notChecked ? <span className="text-[#71561d]">Menu not checked</span> : <><span className="text-[#a44432]">{warnings} label warning{warnings === 1 ? "" : "s"}</span><span className="text-[#806327]">{reviews} {reviews === 1 ? "needs" : "need"} review</span></>}</div>}
      </div>
      <span className="hidden text-xs font-bold sm:block">Open map</span><ArrowUpRight className="size-4 shrink-0 text-[var(--tomato)]" />
    </Link>
    {storageError && <p role="alert" className="px-5 pb-4 text-xs leading-6 text-[#8c3327]">{storageError}</p>}
  </aside>;
}
