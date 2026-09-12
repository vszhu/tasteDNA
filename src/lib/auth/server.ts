import "server-only";

import { createAuthenticatedSupabaseServerClient } from "@/lib/db/supabase-auth-server";
import { SupabaseTasteRepository } from "@/lib/taste/repository";
import { ensurePublicUser } from "./bootstrap";
import { sessionUserFromSupabase } from "./supabase-adapter";
import type { SessionUser } from "./types";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const client = await createAuthenticatedSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const user = sessionUserFromSupabase(data.user);
  await ensurePublicUser(client, user);
  return user;
}

export async function getCurrentTasteProfile() {
  const client = await createAuthenticatedSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const user = sessionUserFromSupabase(data.user);
  await ensurePublicUser(client, user);
  const state = await new SupabaseTasteRepository(client).load(user.id);
  return state.profile;
}
