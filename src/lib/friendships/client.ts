import { z } from "zod";
import type {
  FriendshipApiSummary,
  FriendshipResponseAction,
} from "./types";

const friendshipSchema = z.object({
  friendshipId: z.string().uuid(),
  userId: z.string().uuid(),
  friendUserId: z.string().uuid(),
  friendDisplayName: z.string(),
  status: z.enum(["pending", "accepted", "declined"]),
  direction: z.enum(["incoming", "outgoing"]),
});

const listResponseSchema = z.object({
  friendships: z.array(friendshipSchema),
});

const requestResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string(),
});

const responseSchema = z.object({
  friendship: friendshipSchema,
});

const errorResponseSchema = z.object({ error: z.string().min(1).max(240) });

export class FriendshipClientError extends Error {
  constructor(message = "Friendships are temporarily unavailable. Please try again.") {
    super(message);
    this.name = "FriendshipClientError";
  }
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function successfulBody(response: Response): Promise<unknown> {
  const body = await responseBody(response);
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw new FriendshipClientError(parsed.success ? parsed.data.error : undefined);
  }
  return body;
}

export function createFriendshipClient(fetcher: typeof fetch = fetch) {
  return {
    async list(): Promise<FriendshipApiSummary[]> {
      const response = await fetcher("/api/friendships", {
        method: "GET",
        cache: "no-store",
      });
      const parsed = listResponseSchema.safeParse(await successfulBody(response));
      if (!parsed.success) throw new FriendshipClientError();
      return parsed.data.friendships;
    },

    async request(email: string): Promise<string> {
      const response = await fetcher("/api/friendships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const parsed = requestResponseSchema.safeParse(await successfulBody(response));
      if (!parsed.success) throw new FriendshipClientError();
      return parsed.data.message;
    },

    async respond(
      friendshipId: string,
      action: FriendshipResponseAction,
    ): Promise<FriendshipApiSummary> {
      const response = await fetcher(
        `/api/friendships/${encodeURIComponent(friendshipId)}/${action}`,
        { method: "POST" },
      );
      const parsed = responseSchema.safeParse(await successfulBody(response));
      if (!parsed.success) throw new FriendshipClientError();
      return parsed.data.friendship;
    },
  };
}
