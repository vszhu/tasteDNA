import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listFriendships,
  NEUTRAL_FRIEND_REQUEST_MESSAGE,
  requestFriendship,
  respondToFriendship,
} from "./http";
import { FriendshipContextError, type FriendshipRequestContext } from "./server-context";
import type {
  FriendshipApiSummary,
  FriendshipRepository,
  FriendshipRequestOutcome,
  FriendshipResponseAction,
} from "./types";

const USER_ID = "81000000-0000-4000-8000-000000000001";
const FRIEND_ID = "81000000-0000-4000-8000-000000000002";
const FRIENDSHIP_ID = "82000000-0000-4000-8000-000000000001";

function summary(
  overrides: Partial<FriendshipApiSummary> = {},
): FriendshipApiSummary {
  return {
    friendshipId: FRIENDSHIP_ID,
    userId: USER_ID,
    friendUserId: FRIEND_ID,
    friendDisplayName: "Friend",
    status: "pending",
    direction: "incoming",
    ...overrides,
  };
}

function repository(overrides: Partial<FriendshipRepository> = {}): FriendshipRepository {
  return {
    listForUser: vi.fn().mockResolvedValue([]),
    listAcceptedForUser: vi.fn().mockResolvedValue([]),
    requestByEmail: vi.fn().mockResolvedValue("created"),
    respond: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function context(repo: FriendshipRepository, userEmail = "me@example.test") {
  return async (): Promise<FriendshipRequestContext> => ({
    userId: USER_ID,
    userEmail,
    repository: repo,
  });
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost:3000/api/friendships", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("friendship HTTP handlers", () => {
  it("lists only repository summaries for the signed-in user", async () => {
    const friendships = [summary({ status: "accepted", direction: "outgoing" })];
    const listForUser = vi.fn().mockResolvedValue(friendships);
    const response = await listFriendships(context(repository({ listForUser })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ friendships });
    expect(listForUser).toHaveBeenCalledWith(USER_ID);
  });

  it("requires a valid session", async () => {
    const response = await listFriendships(async () => {
      throw new FriendshipContextError("Sign in to manage friendships.", 401);
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in to manage friendships.",
    });
  });

  it("rejects malformed email input before repository access", async () => {
    const requestByEmail = vi.fn();
    const response = await requestFriendship(
      jsonRequest({ email: "not-an-email" }),
      context(repository({ requestByEmail })),
    );

    expect(response.status).toBe(400);
    expect(requestByEmail).not.toHaveBeenCalled();
  });

  it.each<FriendshipRequestOutcome>(["created", "existing", "not-found"])(
    "returns one neutral response for the %s outcome",
    async (outcome) => {
      const requestByEmail = vi.fn().mockResolvedValue(outcome);
      const response = await requestFriendship(
        jsonRequest({ email: "  FRIEND@Example.Test " }),
        context(repository({ requestByEmail })),
      );

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        message: NEUTRAL_FRIEND_REQUEST_MESSAGE,
      });
      expect(requestByEmail).toHaveBeenCalledWith(USER_ID, "friend@example.test");
    },
  );

  it("rejects a self request without calling the email lookup", async () => {
    const requestByEmail = vi.fn();
    const response = await requestFriendship(
      jsonRequest({ email: "ME@example.test" }),
      context(repository({ requestByEmail })),
    );

    expect(response.status).toBe(400);
    expect(requestByEmail).not.toHaveBeenCalled();
  });

  it.each<[FriendshipResponseAction, "accepted" | "declined"]>([
    ["accept", "accepted"],
    ["reject", "declined"],
  ])("allows the addressee result for %s", async (action, status) => {
    const friendship = summary({ status });
    const respond = vi.fn().mockResolvedValue(friendship);
    const response = await respondToFriendship(
      FRIENDSHIP_ID,
      action,
      context(repository({ respond })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ friendship });
    expect(respond).toHaveBeenCalledWith(USER_ID, FRIENDSHIP_ID, action);
  });

  it("does not distinguish an unauthorized response from a missing request", async () => {
    const respond = vi.fn().mockResolvedValue(null);
    const response = await respondToFriendship(
      FRIENDSHIP_ID,
      "accept",
      context(repository({ respond })),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Friend request not found." });
  });
});
