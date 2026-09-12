import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "./types";

/** Idempotent fallback for projects that contained Auth users before the trigger landed. */
export async function ensurePublicUser(client: SupabaseClient, user: SessionUser) {
  const { error } = await client
    .from("users")
    .upsert({ id: user.id, display_name: user.displayName }, { onConflict: "id" });
  if (error) throw new Error("Unable to initialize the signed-in account.");
}
