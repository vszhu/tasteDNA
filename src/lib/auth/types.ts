/** Browser-safe identity projected from a verified Supabase user. */

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export type SessionStatus = "loading" | "signed-out" | "signed-in";

export type FriendshipStatus = "pending-outgoing" | "pending-incoming" | "accepted";

export interface Friend {
  friendshipId: string;
  user: SessionUser;
  status: FriendshipStatus;
}

export type SendFriendRequestResult = { ok: true } | { ok: false; reason: "self" | "already-friends" | "already-pending" | "invalid-email" };
