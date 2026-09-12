import { describe, expect, it, vi } from "vitest";
import { createFriendshipClient, FriendshipClientError } from "./client";

const friendship = {
  friendshipId: "10000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  friendUserId: "30000000-0000-4000-8000-000000000001",
  friendDisplayName: "Grace",
  status: "pending",
  direction: "incoming",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("friendship browser client", () => {
  it("lists validated friendships without caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ friendships: [friendship] }));
    const client = createFriendshipClient(fetcher);

    await expect(client.list()).resolves.toEqual([friendship]);
    expect(fetcher).toHaveBeenCalledWith("/api/friendships", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("returns the neutral request response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        { ok: true, message: "If that email has an account, they'll see your request." },
        202,
      ),
    );
    const client = createFriendshipClient(fetcher);

    await expect(client.request("friend@example.test")).resolves.toContain("they'll see");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/friendships",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "friend@example.test" }),
      }),
    );
  });

  it("uses the explicit accept and reject endpoints", async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ friendship: { ...friendship, status: "accepted" } })),
    );
    const client = createFriendshipClient(fetcher);

    await client.respond(friendship.friendshipId, "accept");
    await client.respond(friendship.friendshipId, "reject");
    expect(fetcher).toHaveBeenCalledWith(
      `/api/friendships/${friendship.friendshipId}/accept`,
      { method: "POST" },
    );
    expect(fetcher).toHaveBeenCalledWith(
      `/api/friendships/${friendship.friendshipId}/reject`,
      { method: "POST" },
    );
  });

  it("uses a safe fallback for malformed API errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: { secret: true } }, 500));
    const client = createFriendshipClient(fetcher);

    await expect(client.list()).rejects.toEqual(
      new FriendshipClientError("Friendships are temporarily unavailable. Please try again."),
    );
  });
});
