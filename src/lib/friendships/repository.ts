import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  FriendshipApiSummary,
  FriendshipRepository,
  FriendshipRequestOutcome,
  FriendshipResponseAction,
} from "./types";

const friendshipRowSchema = z.object({
  id: z.string().uuid(),
  requester_id: z.string().uuid(),
  addressee_id: z.string().uuid(),
  status: z.enum(["pending", "accepted", "rejected"]),
});

const publicUserRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable(),
});

const requestOutcomeSchema = z.enum(["created", "existing", "not-found", "self"]);

type FriendshipRow = z.infer<typeof friendshipRowSchema>;

export class FriendshipRepositoryError extends Error {
  constructor() {
    super("Friendship storage is temporarily unavailable.");
    this.name = "FriendshipRepositoryError";
  }
}

function friendUserId(row: FriendshipRow, userId: string) {
  return row.requester_id === userId ? row.addressee_id : row.requester_id;
}

function mapSummary(
  row: FriendshipRow,
  userId: string,
  displayNames: ReadonlyMap<string, string>,
): FriendshipApiSummary {
  const friendId = friendUserId(row, userId);
  return {
    friendshipId: row.id,
    userId,
    friendUserId: friendId,
    friendDisplayName: displayNames.get(friendId) ?? "TasteDNA user",
    status: row.status === "rejected" ? "declined" : row.status,
    direction: row.requester_id === userId ? "outgoing" : "incoming",
  };
}

/**
 * Friendship rows and responses use the signed-in client so Task 1 RLS remains
 * active. The privileged client is limited to counterpart display names and
 * the service-only, non-enumerating email request function.
 */
export class SupabaseFriendshipRepository implements FriendshipRepository {
  constructor(
    private readonly userClient: SupabaseClient,
    private readonly adminClient: SupabaseClient,
  ) {}

  private async displayNames(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return new Map<string, string>();

    const { data, error } = await this.adminClient
      .from("users")
      .select("id,display_name")
      .in("id", uniqueIds);
    if (error) throw new FriendshipRepositoryError();

    const users = z.array(publicUserRowSchema).parse(data ?? []);
    return new Map(
      users.map((user) => [
        user.id,
        user.display_name?.trim() || "TasteDNA user",
      ]),
    );
  }

  async listForUser(userId: string): Promise<FriendshipApiSummary[]> {
    const { data, error } = await this.userClient
      .from("friendships")
      .select("id,requester_id,addressee_id,status")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: true });
    if (error) throw new FriendshipRepositoryError();

    const rows = z.array(friendshipRowSchema).parse(data ?? []);
    const names = await this.displayNames(rows.map((row) => friendUserId(row, userId)));
    return rows.map((row) => mapSummary(row, userId, names));
  }

  async listAcceptedForUser(userId: string): Promise<FriendshipApiSummary[]> {
    const friendships = await this.listForUser(userId);
    return friendships.filter((friendship) => friendship.status === "accepted");
  }

  async requestByEmail(userId: string, email: string): Promise<FriendshipRequestOutcome> {
    const { data, error } = await this.adminClient.rpc("request_friendship_by_email", {
      p_requester_id: userId,
      p_email: email,
    });
    if (error) throw new FriendshipRepositoryError();
    return requestOutcomeSchema.parse(data);
  }

  async respond(
    userId: string,
    friendshipId: string,
    action: FriendshipResponseAction,
  ): Promise<FriendshipApiSummary | null> {
    const status = action === "accept" ? "accepted" : "rejected";
    const { data, error } = await this.userClient
      .from("friendships")
      .update({ status })
      .eq("id", friendshipId)
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .select("id,requester_id,addressee_id,status")
      .maybeSingle();
    if (error) throw new FriendshipRepositoryError();
    if (!data) return null;

    const row = friendshipRowSchema.parse(data);
    const names = await this.displayNames([friendUserId(row, userId)]);
    return mapSummary(row, userId, names);
  }
}

