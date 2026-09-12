"use client";

import Link from "next/link";
import { LockKeyhole, Save, Users } from "lucide-react";
import { useMedications } from "@/components/providers/medication-provider";
import { Button } from "@/components/ui/button";

export function AccountMedicationSettings() {
  const { hydrated, accountAvailable, savedAccount, hasUnsavedChanges, saving, groupChecksEnabled, setGroupChecksEnabled, saveToAccount, deleteAccountCopy, accountError } = useMedications();
  return <section aria-label="Private account medication settings" className="mt-5 rounded-2xl border border-[#d5dcd8] bg-[#f1f4f2] p-4 sm:p-5">
    <p className="flex items-center gap-2 text-sm font-bold"><LockKeyhole className="size-4" /> Your list. Your choice.</p>
    <p className="mt-2 text-xs leading-6 text-[var(--muted)]">Edits stay in this tab until you save them to your private account. Medication names are never sent to AI or shown to friends.</p>
    {accountAvailable ? <>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3">
        <input type="checkbox" checked={groupChecksEnabled} disabled={!hydrated || saving} onChange={(event) => setGroupChecksEnabled(event.target.checked)} className="mt-1 size-4 shrink-0 accent-[#315e4b]" />
        <span><span className="flex items-center gap-2 text-sm font-bold"><Users className="size-4" /> Use my saved list in group meals</span><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Check my dishes when a friend computes our meal. The group can see which dishes need private medication review and overall check coverage, but never my medication list. Saving an empty list means I have no medications to check.</span></span>
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={!hydrated || saving || !hasUnsavedChanges} onClick={() => void saveToAccount()}><Save className="size-4" />{saving ? "Saving…" : "Save to my account"}</Button>
        {savedAccount && <Button variant="ghost" size="sm" disabled={saving} onClick={() => void deleteAccountCopy()}>Delete saved copy</Button>}
      </div>
      <p role="status" className="mt-3 text-xs leading-5 text-[var(--muted)]">{!hydrated ? "Loading account settings…" : hasUnsavedChanges ? "Unsaved tab changes. Group meals use your last saved settings." : savedAccount?.use_in_groups ? "Saved · your list is connected to group meals." : "Saved privately · group medication checks are off for you."}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Saving or deleting your account copy expires previous group results. Clearing the tab list takes effect for groups only after saving.</p>
    </> : <Link href="/sign-in" className="mt-3 inline-flex min-h-10 items-center text-xs font-bold underline underline-offset-4">Sign in to save your list and connect group meals</Link>}
    {accountError && <p role="alert" className="mt-3 text-sm text-[#8c3327]">{accountError}</p>}
  </section>;
}
