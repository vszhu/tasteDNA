import type { FriendshipSummary } from "@/types/group";

export type FriendshipDirection = "incoming" | "outgoing";

/**
 * The shared contract intentionally omits email addresses. Direction is the
 * only API-specific field needed to render pending requests correctly.
 */
export interface FriendshipApiSummary extends FriendshipSummary {
  direction: FriendshipDirection;
}

export type FriendshipRequestOutcome =
  | "created"
  | "existing"
  | "not-found"
  | "self";

export type FriendshipResponseAction = "accept" | "reject";

export interface FriendshipRepository {
  listForUser(userId: string): Promise<FriendshipApiSummary[]>;
  listAcceptedForUser(userId: string): Promise<FriendshipApiSummary[]>;
  requestByEmail(userId: string, email: string): Promise<FriendshipRequestOutcome>;
  respond(
    userId: string,
    friendshipId: string,
    action: FriendshipResponseAction,
  ): Promise<FriendshipApiSummary | null>;
}

