"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { getSupabaseBrowserClient } from "@/lib/db/supabase";
import { createMedicationAccountRepository, type MedicationAccount } from "@/lib/medications/account";
import { MAX_MEDICATIONS, MAX_MEDICATION_NAME_LENGTH, medicationStorageKey, normalizeMedicationSelections, parseMedicationSelections } from "@/lib/medications/storage";

interface MedicationContextValue {
  medications: string[];
  hydrated: boolean;
  storageError: string | null;
  accountAvailable: boolean;
  accountError: string | null;
  savedAccount: MedicationAccount | null;
  hasUnsavedChanges: boolean;
  saving: boolean;
  groupChecksEnabled: boolean;
  setGroupChecksEnabled: (enabled: boolean) => void;
  saveToAccount: () => Promise<void>;
  deleteAccountCopy: () => Promise<void>;
  addMedication: (value: string) => void;
  removeMedication: (value: string) => void;
  clearMedications: () => void;
}
const MedicationContext = createContext<MedicationContextValue | null>(null);
const EMPTY: string[] = [];
interface State {
  scope: string | null;
  medications: string[];
  error: string | null;
  accountError: string | null;
  savedAccount: MedicationAccount | null;
  groupChecksEnabled: boolean;
  saving: boolean;
}
const initialState: State = { scope: null, medications: [], error: null, accountError: null, savedAccount: null, groupChecksEnabled: false, saving: false };
function cache(scope: string, medications: string[]): string | null {
  try {
    if (medications.length) sessionStorage.setItem(medicationStorageKey(scope), JSON.stringify(medications));
    else sessionStorage.removeItem(medicationStorageKey(scope));
    return null;
  } catch { return "This browser could not save your changes. Review your list before using medication checks; a previous list may return after reloading."; }
}
function draftKey(scope: string) { return `${medicationStorageKey(scope)}:draft`; }
function rememberDraft(scope: string, account: MedicationAccount | null, enabled: boolean) {
  try { sessionStorage.setItem(draftKey(scope), JSON.stringify({ revision: account?.revision ?? "none", enabled })); }
  catch { /* The list cache reports storage failures; cloud writes remain explicit. */ }
}

/** Tab drafts stay separate from explicit, owner-only account saves and group consent. */
export function MedicationProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useSession();
  const userId = status === "signed-in" ? user?.id : undefined;
  const scope = status === "loading" || (status === "signed-in" && !user) ? null : userId ? `user:${userId}` : "anonymous";
  const [state, setState] = useState<State>(initialState);
  const generation = useRef(0);
  const writing = useRef<number | null>(null);
  const hydrated = scope !== null && state.scope === scope;
  const medications = hydrated ? state.medications : EMPTY;
  const accountAvailable = Boolean(userId && getSupabaseBrowserClient());

  useEffect(() => {
    const current = ++generation.current;
    writing.current = null;
    let active = true;
    if (!scope) return;
    void (async () => {
      await Promise.resolve();
      const next: State = { ...initialState, scope };
      try { next.medications = parseMedicationSelections(sessionStorage.getItem(medicationStorageKey(scope))); }
      catch { next.error = "Your medication list could not be restored. Add it again before using medication checks."; }
      const client = userId ? getSupabaseBrowserClient() : null;
      if (client && userId) {
        try {
          next.savedAccount = await createMedicationAccountRepository(client).load(userId);
          const rawDraft = sessionStorage.getItem(draftKey(scope));
          const draft = rawDraft ? JSON.parse(rawDraft) : null;
          const restoreDraft = draft?.revision === (next.savedAccount?.revision ?? "none") && typeof draft?.enabled === "boolean";
          if (next.savedAccount) {
            if (!restoreDraft) next.medications = next.savedAccount.medications;
            next.groupChecksEnabled = next.savedAccount.use_in_groups;
            if (active && current === generation.current) next.error = cache(scope, next.medications);
          }
          if (restoreDraft) next.groupChecksEnabled = draft.enabled;
        } catch { next.accountError = "Your saved account list could not be loaded. Review the tab list before saving; group meals may use an earlier saved list."; }
      }
      // Do not let an old account's network response restore its list after a switch.
      if (active && current === generation.current) setState(next);
    })();
    return () => { active = false; };
  }, [scope, userId]);

  const update = useCallback((next: string[]) => {
    if (!hydrated || !scope || state.saving) return;
    const error = cache(scope, next);
    if (userId) rememberDraft(scope, state.savedAccount, state.groupChecksEnabled);
    setState((previous) => previous.scope === scope ? { ...previous, medications: next, error } : previous);
  }, [hydrated, scope, state.saving, state.savedAccount, state.groupChecksEnabled, userId]);
  const addMedication = useCallback((value: string) => {
    if (!value.trim() || value.length > MAX_MEDICATION_NAME_LENGTH) return;
    const next = normalizeMedicationSelections([...medications, value]);
    if (next.length <= MAX_MEDICATIONS) update(next);
  }, [medications, update]);
  const removeMedication = useCallback((value: string) => update(medications.filter((entry) => entry !== value)), [medications, update]);
  const clearMedications = useCallback(() => update([]), [update]);
  const setGroupChecksEnabled = useCallback((enabled: boolean) => {
    if (hydrated && scope && !state.saving) {
      rememberDraft(scope, state.savedAccount, enabled);
      setState((previous) => ({ ...previous, groupChecksEnabled: enabled }));
    }
  }, [hydrated, scope, state.savedAccount, state.saving]);

  const accountWrite = useCallback(async (remove: boolean) => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !hydrated || state.saving || writing.current !== null) return;
    const current = generation.current;
    writing.current = current;
    setState((previous) => ({ ...previous, saving: true, accountError: null }));
    try {
      const repository = createMedicationAccountRepository(client);
      const saved = remove ? (await repository.remove(userId), null) : await repository.save(userId, medications, state.groupChecksEnabled);
      if (current !== generation.current) return;
      try { if (scope) sessionStorage.removeItem(draftKey(scope)); } catch { /* The account save already succeeded. */ }
      setState((previous) => previous.scope === scope ? { ...previous, saving: false, savedAccount: saved, groupChecksEnabled: saved?.use_in_groups ?? false } : previous);
    } catch {
      if (current !== generation.current) return;
      setState((previous) => previous.scope === scope ? { ...previous, saving: false, accountError: "Account medication saving is unavailable. Your changes stay in this tab; group meals use your last saved settings." } : previous);
    } finally {
      if (writing.current === current) writing.current = null;
    }
  }, [hydrated, medications, scope, state.groupChecksEnabled, state.saving, userId]);
  const saveToAccount = useCallback(() => accountWrite(false), [accountWrite]);
  const deleteAccountCopy = useCallback(() => accountWrite(true), [accountWrite]);
  const savedAccount = hydrated ? state.savedAccount : null;
  const hasUnsavedChanges = hydrated && (!savedAccount || JSON.stringify(medications) !== JSON.stringify(savedAccount.medications) || state.groupChecksEnabled !== savedAccount.use_in_groups);

  return <MedicationContext.Provider value={{ medications, hydrated, storageError: hydrated ? state.error : null, accountAvailable, accountError: hydrated ? state.accountError : null, savedAccount, hasUnsavedChanges, saving: hydrated && state.saving, groupChecksEnabled: hydrated && state.groupChecksEnabled, setGroupChecksEnabled, saveToAccount, deleteAccountCopy, addMedication, removeMedication, clearMedications }}>{children}</MedicationContext.Provider>;
}
export function useMedications() {
  const context = useContext(MedicationContext);
  if (!context) throw new Error("useMedications must be used within MedicationProvider");
  return context;
}
