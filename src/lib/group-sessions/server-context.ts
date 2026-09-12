import "server-only";

import { ensurePublicUser } from "@/lib/auth/bootstrap";
import { sessionUserFromSupabase } from "@/lib/auth/supabase-adapter";
import { createAuthenticatedSupabaseServerClient } from "@/lib/db/supabase-auth-server";
import { getSupabaseAdminClient } from "@/lib/db/supabase-server";
import { SupabaseGroupSessionRepository } from "./repository";
import type { GroupSessionRepository } from "./types";

export class GroupSessionContextError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GroupSessionContextError";
  }
}

export interface GroupSessionRequestContext {
  userId: string;
  repository: GroupSessionRepository;
}

export async function createGroupSessionRequestContext(): Promise<GroupSessionRequestContext> {
  const userClient = await createAuthenticatedSupabaseServerClient();
  if (!userClient) {
    throw new GroupSessionContextError("Supabase sign-in is not configured.", 503);
  }

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new GroupSessionContextError("Sign in to manage group sessions.", 401);
  }

  const user = sessionUserFromSupabase(data.user);
  await ensurePublicUser(userClient, user);
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    throw new GroupSessionContextError("Group session storage is not configured.", 503);
  }

  return {
    userId: user.id,
    repository: new SupabaseGroupSessionRepository(userClient, adminClient),
  };
}
