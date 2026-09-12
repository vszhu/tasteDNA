import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/friend-rules";
import {
  createFriendshipRequestContext,
  FriendshipContextError,
  type FriendshipRequestContext,
} from "./server-context";
import type { FriendshipResponseAction } from "./types";

const emailRequestSchema = z.object({
  email: z.string().trim().max(320).email(),
});

const friendshipIdSchema = z.string().uuid();

export const NEUTRAL_FRIEND_REQUEST_MESSAGE =
  "If that email has an account, they'll see your request.";

export type FriendshipContextFactory = () => Promise<FriendshipRequestContext>;

function apiFailure(error: unknown) {
  if (error instanceof FriendshipContextError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Friendship API failed", {
    name: error instanceof Error ? error.name : "unknown_error",
  });
  return NextResponse.json(
    { error: "Friendships are temporarily unavailable. Please try again." },
    { status: 500 },
  );
}

export async function listFriendships(
  contextFactory: FriendshipContextFactory = createFriendshipRequestContext,
) {
  try {
    const { userId, repository } = await contextFactory();
    const friendships = await repository.listForUser(userId);
    return NextResponse.json({ friendships });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function requestFriendship(
  request: Request,
  contextFactory: FriendshipContextFactory = createFriendshipRequestContext,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid email address." }, { status: 400 });
  }

  const parsed = emailRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Send a valid email address." }, { status: 400 });
  }

  try {
    const { userId, userEmail, repository } = await contextFactory();
    const email = normalizeEmail(parsed.data.email);
    if (email === normalizeEmail(userEmail)) {
      return NextResponse.json({ error: "You cannot send a friend request to yourself." }, { status: 400 });
    }

    const outcome = await repository.requestByEmail(userId, email);
    if (outcome === "self") {
      return NextResponse.json({ error: "You cannot send a friend request to yourself." }, { status: 400 });
    }

    // Created, unknown, duplicate, reversed, and terminal relationships are
    // deliberately indistinguishable to prevent account enumeration.
    return NextResponse.json(
      { ok: true, message: NEUTRAL_FRIEND_REQUEST_MESSAGE },
      { status: 202 },
    );
  } catch (error) {
    return apiFailure(error);
  }
}

export async function respondToFriendship(
  friendshipId: string,
  action: FriendshipResponseAction,
  contextFactory: FriendshipContextFactory = createFriendshipRequestContext,
) {
  const parsedId = friendshipIdSchema.safeParse(friendshipId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
  }

  try {
    const { userId, repository } = await contextFactory();
    const friendship = await repository.respond(userId, parsedId.data, action);
    if (!friendship) {
      return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
    }
    return NextResponse.json({ friendship });
  } catch (error) {
    return apiFailure(error);
  }
}

