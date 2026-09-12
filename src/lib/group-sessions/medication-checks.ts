import { createHash } from "node:crypto";
import { scoreRestaurantForMember, type GroupRankingInput } from "@/lib/group/ranking";
import { checkDishMedications } from "@/lib/medications/check";
import { MEDICATION_RULES_VERSION } from "@/lib/medications/catalog";
import type { MedicationAccount } from "@/lib/medications/account";
import type { GroupMedicationSummary } from "@/types/group";
import { GroupSessionError } from "./types";

/** Fingerprints random revision IDs, never low-entropy medication names. */
export function medicationVersionFingerprint(versions: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
}
export function medicationVersions(memberIds: string[], accounts: Pick<MedicationAccount, "user_id" | "revision">[]) {
  const byUser = new Map(accounts.map((entry) => [entry.user_id, entry.revision]));
  return Object.fromEntries([...memberIds].sort().map((id) => [id, byUser.get(id) ?? "none"]));
}

/** Private lists are reduced to dish IDs before entering the shared ranking engine. */
export function prepareGroupMedicationChecks(input: GroupRankingInput, accounts: MedicationAccount[], savedVersions?: Record<string, string>): { input: GroupRankingInput; summary: GroupMedicationSummary; versions: Record<string, string> } {
  const active = input.members.filter((entry) => entry.member.status === "joined" || entry.member.status === "responded");
  const byUser = new Map(accounts.map((entry) => [entry.user_id, entry]));
  let checkedMembers = 0;
  let flaggedDishOptions = 0;
  const members = active.map((entry) => {
    const account = byUser.get(entry.member.userId);
    if (!account?.use_in_groups) return entry;
    checkedMembers++;
    const flagged = input.venues.flatMap((venue) => venue.menuItems.flatMap((item) => {
      const check = checkDishMedications(item.dish, account.medications);
      return check.status === "avoid" || check.status === "review" ? [item.id] : [];
    }));
    flaggedDishOptions += flagged.length;
    return { ...entry, medicationExcludedItemIds: flagged };
  });
  // Do not pick a restaurant lacking an unflagged option for any opted-in member.
  const venues = checkedMembers ? input.venues.filter((venue) => venue.menuItems.length > 0 && members.every((entry) =>
    scoreRestaurantForMember(entry, venue).dishUtilities.some((item) => !item.excluded),
  )) : input.venues;
  if (checkedMembers && venues.length === 0) throw new GroupSessionError("missing-input", "Every candidate needs a medication or ingredient review for someone in the group. Review the menus and saved lists before choosing; no unchecked dish was assigned.");
  const versions = savedVersions ?? medicationVersions(active.map((entry) => entry.member.userId), accounts);
  return {
    input: checkedMembers ? { ...input, members, venues } : input,
    versions,
    summary: { checkedMembers, uncheckedMembers: active.length - checkedMembers, flaggedDishOptions, withheldVenues: input.venues.length - venues.length, rulesVersion: MEDICATION_RULES_VERSION, revisionFingerprint: medicationVersionFingerprint(versions) },
  };
}
