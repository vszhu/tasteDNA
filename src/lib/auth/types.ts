/**
 * Temporary, UI-scoped auth/friends contracts.
 *
 * The real backend (Supabase magic-link auth, `friendships` table) hasn't
 * landed yet — this is exactly the kind of typed mock the shared plan doc
 * calls for so UI work isn't blocked on it. Everything here is deliberately
 * small and mirrors the shape a real API would return. Swapping the mock
 * adapter in `mock-adapter.ts` for a real one should not require changing
 * any component that consumes these types.
 */

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
