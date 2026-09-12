"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { MAX_MEDICATIONS, MAX_MEDICATION_NAME_LENGTH, medicationStorageKey, normalizeMedicationSelections, parseMedicationSelections } from "@/lib/medications/storage";

interface MedicationContextValue {
  medications: string[];
  hydrated: boolean;
  storageError: string | null;
  addMedication: (value: string) => void;
  removeMedication: (value: string) => void;
  clearMedications: () => void;
}

const MedicationContext = createContext<MedicationContextValue | null>(null);
const EMPTY: string[] = [];

/** Health selections stay in this tab's session storage, scoped to the signed-in account. */
export function MedicationProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useSession();
  const scope = status === "loading" || (status === "signed-in" && !user) ? null : status === "signed-in" && user ? `user:${user.id}` : "anonymous";
  const [state, setState] = useState<{ scope: string | null; medications: string[]; error: string | null }>({ scope: null, medications: [], error: null });
  const hydrated = scope !== null && state.scope === scope;
  const medications = hydrated ? state.medications : EMPTY;

  useEffect(() => {
    if (!scope) return;
    let active = true;
    // Hydrate after mount, and never render the preceding account's list while switching.
    queueMicrotask(() => {
      if (!active) return;
      try {
        setState({ scope, medications: parseMedicationSelections(sessionStorage.getItem(medicationStorageKey(scope))), error: null });
      } catch {
        setState({ scope, medications: [], error: "Your medication list could not be restored. Add it again before using medication checks." });
      }
    });
    return () => { active = false; };
  }, [scope]);

  const update = useCallback((next: string[]) => {
    if (!hydrated || !scope) return;
    let error: string | null = null;
    try {
      if (next.length) sessionStorage.setItem(medicationStorageKey(scope), JSON.stringify(next));
      else sessionStorage.removeItem(medicationStorageKey(scope));
    } catch {
      error = "This browser could not save your changes. Review your list before using medication checks; a previous list may return after reloading.";
    }
    setState({ scope, medications: next, error });
  }, [hydrated, scope]);

  const addMedication = useCallback((value: string) => {
    if (!value.trim() || value.length > MAX_MEDICATION_NAME_LENGTH) return;
    const next = normalizeMedicationSelections([...medications, value]);
    if (next.length <= MAX_MEDICATIONS) update(next);
  }, [medications, update]);
  const removeMedication = useCallback((value: string) => update(medications.filter((entry) => entry !== value)), [medications, update]);
  const clearMedications = useCallback(() => update([]), [update]);

  return <MedicationContext.Provider value={{ medications, hydrated, storageError: hydrated ? state.error : null, addMedication, removeMedication, clearMedications }}>{children}</MedicationContext.Provider>;
}

export function useMedications() {
  const context = useContext(MedicationContext);
  if (!context) throw new Error("useMedications must be used within MedicationProvider");
  return context;
}
