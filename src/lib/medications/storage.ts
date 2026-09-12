import { findMedication, normalizeMedicationName } from "./catalog";

export const MAX_MEDICATIONS = 12;
export const MAX_MEDICATION_NAME_LENGTH = 100;

export function medicationStorageKey(scope: string): string {
  return `tastedna-medications-v1:${scope}`;
}

export function normalizeMedicationSelections(values: readonly string[]): string[] {
  return [...new Map(values.map((value) => {
    const name = value.trim();
    const canonical = findMedication(name)?.id ?? name;
    return [normalizeMedicationName(canonical), canonical] as const;
  })).values()].filter(Boolean);
}

/** Fail visibly on invalid saved state rather than silently dropping an unknown medication. */
export function parseMedicationSelections(raw: string | null): string[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > MAX_MEDICATIONS || parsed.some((entry) =>
    typeof entry !== "string" || !entry.trim() || entry.length > MAX_MEDICATION_NAME_LENGTH,
  )) throw new Error("Invalid medication list");
  return normalizeMedicationSelections(parsed);
}
