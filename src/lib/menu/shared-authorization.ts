import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionUserFromSupabase } from "@/lib/auth/supabase-adapter";

export class SharedMenuAuthorizationError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "Sign in to attach a menu to a venue." : "That venue cannot accept shared menu uploads.");
    this.name = "SharedMenuAuthorizationError";
  }
}

/** Returns a verified uploader only when the target is an active public venue. */
export async function authorizeSharedMenuUpload(client: SupabaseClient, venueId: string) {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new SharedMenuAuthorizationError(401);

  const { data: venue, error: venueError } = await client
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .eq("is_active", true)
    .maybeSingle();
  if (venueError || !venue) throw new SharedMenuAuthorizationError(403);

  return sessionUserFromSupabase(authData.user);
}
