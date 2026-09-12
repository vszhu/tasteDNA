import type { Friend, SendFriendRequestResult } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

/**
 * Decides whether a friend request to `targetEmail` is allowed to proceed,
 * without revealing anything about whether that email has an account —
 * callers must show the same neutral confirmation copy regardless of the
 * underlying reason so the UI never becomes an email-enumeration oracle.
 */
export function canSendFriendRequest(friends: Friend[], targetEmail: string, selfEmail: string): SendFriendRequestResult {
  const normalizedTarget = normalizeEmail(targetEmail);
  if (!isValidEmail(normalizedTarget)) return { ok: false, reason: "invalid-email" };
  if (normalizedTarget === normalizeEmail(selfEmail)) return { ok: false, reason: "self" };
  const existing = friends.find((friend) => normalizeEmail(friend.user.email) === normalizedTarget);
  if (existing?.status === "accepted") return { ok: false, reason: "already-friends" };
  if (existing?.status === "pending-outgoing" || existing?.status === "pending-incoming") return { ok: false, reason: "already-pending" };
  return { ok: true };
}

/** Pure reducer: applies an accept/reject decision to a pending-incoming request. */
export function respondToRequest(friends: Friend[], friendshipId: string, action: "accept" | "reject"): Friend[] {
  if (action === "reject") return friends.filter((friend) => friend.friendshipId !== friendshipId);
  return friends.map((friend) => (friend.friendshipId === friendshipId ? { ...friend, status: "accepted" } : friend));
}
