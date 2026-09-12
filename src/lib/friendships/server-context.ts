import "server-only";

import { ensurePublicUser } from "@/lib/auth/bootstrap";
import { sessionUserFromSupabase } from "@/lib/auth/supabase-adapter";
import { createAuthenticatedSupabaseServerClient } from "@/lib/db/supabase-auth-server";
import { getSupabaseAdminClient } from "@/lib/db/supabase-server";
import { SupabaseFriendshipRepository } from "./repository";
import type { FriendshipRepository } from "./types";

export class FriendshipContextError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FriendshipContextError";
  }
}

export interface FriendshipRequestContext {
  userId: string;
  userEmail: string;
  repository: FriendshipRepository;
}

export async function createFriendshipRequestContext(): Promise<FriendshipRequestContext> {
  const userClient = await createAuthenticatedSupabaseServerClient();
  if (!userClient) {
    throw new FriendshipContextError("Supabase sign-in is not configured.", 503);
  }

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new FriendshipContextError("Sign in to manage friendships.", 401);
  }

  const user = sessionUserFromSupabase(data.user);
  await ensurePublicUser(userClient, user);

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    throw new FriendshipContextError("Friendship storage is not configured.", 503);
  }

  return {
    userId: user.id,
    userEmail: user.email,
    repository: new SupabaseFriendshipRepository(userClient, adminClient),
  };
}

