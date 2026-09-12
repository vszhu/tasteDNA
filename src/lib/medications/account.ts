import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_MEDICATIONS, MAX_MEDICATION_NAME_LENGTH, normalizeMedicationSelections } from "./storage";

export const medicationAccountSchema = z.object({
  user_id: z.string().uuid(),
  medications: z.array(z.string().trim().min(1).max(MAX_MEDICATION_NAME_LENGTH)).max(MAX_MEDICATIONS),
  use_in_groups: z.boolean(),
  revision: z.string().uuid(),
  updated_at: z.string(),
});
export type MedicationAccount = z.infer<typeof medicationAccountSchema>;
export const MEDICATION_ACCOUNT_SELECT = "user_id,medications,use_in_groups,revision,updated_at";

function failure() { return new Error("Account medication saving is unavailable. Your changes stay in this tab; group meals use your last saved settings."); }
function checked(value: unknown, userId: string) {
  const parsed = medicationAccountSchema.safeParse(value);
  if (!parsed.success || parsed.data.user_id !== userId) throw failure();
  return { ...parsed.data, medications: normalizeMedicationSelections(parsed.data.medications) };
}

/** The browser uses its own JWT. RLS permits only the owner to read or change a list. */
export function createMedicationAccountRepository(client: SupabaseClient) {
  return {
    async load(userId: string): Promise<MedicationAccount | null> {
      const { data, error } = await client.from("user_medication_profiles").select(MEDICATION_ACCOUNT_SELECT).eq("user_id", userId).maybeSingle();
      if (error) throw failure();
      return data ? checked(data, userId) : null;
    },
    async save(userId: string, medications: string[], useInGroups: boolean): Promise<MedicationAccount> {
      const { data, error } = await client.from("user_medication_profiles").upsert({
        user_id: userId, medications: normalizeMedicationSelections(medications), use_in_groups: useInGroups,
      }, { onConflict: "user_id" }).select(MEDICATION_ACCOUNT_SELECT).single();
      if (error) throw failure();
      return checked(data, userId);
    },
    async remove(userId: string): Promise<void> {
      const { error } = await client.from("user_medication_profiles").delete().eq("user_id", userId);
      if (error) throw failure();
    },
  };
}
