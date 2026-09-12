import { describe, expect, it } from "vitest";
import { canSendFriendRequest, isValidEmail, normalizeEmail, respondToRequest } from "./friend-rules";
import type { Friend } from "./types";

function friend(overrides: Partial<Friend> = {}): Friend {
  return {
    friendshipId: "f1",
    user: { id: "u1", email: "friend@andrew.cmu.edu", displayName: "Friend" },
    status: "accepted",
    ...overrides,
  };
}

describe("normalizeEmail / isValidEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Person@ANDREW.cmu.edu ")).toBe("person@andrew.cmu.edu");
  });

  it("accepts well-formed emails and rejects malformed ones", () => {
    expect(isValidEmail("person@andrew.cmu.edu")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("canSendFriendRequest", () => {
  const self = "me@andrew.cmu.edu";

  it("rejects an invalid email", () => {
    expect(canSendFriendRequest([], "nope", self)).toEqual({ ok: false, reason: "invalid-email" });
  });

  it("rejects sending a request to yourself", () => {
    expect(canSendFriendRequest([], "Me@andrew.cmu.edu", self)).toEqual({ ok: false, reason: "self" });
  });

  it("rejects when already friends", () => {
    const friends = [friend({ status: "accepted", user: { id: "u1", email: "a@andrew.cmu.edu", displayName: "A" } })];
    expect(canSendFriendRequest(friends, "a@andrew.cmu.edu", self)).toEqual({ ok: false, reason: "already-friends" });
  });

  it("rejects when a request is already pending in either direction", () => {
    const outgoing = [friend({ status: "pending-outgoing", user: { id: "u1", email: "a@andrew.cmu.edu", displayName: "A" } })];
    const incoming = [friend({ status: "pending-incoming", user: { id: "u2", email: "b@andrew.cmu.edu", displayName: "B" } })];
    expect(canSendFriendRequest(outgoing, "a@andrew.cmu.edu", self)).toEqual({ ok: false, reason: "already-pending" });
    expect(canSendFriendRequest(incoming, "b@andrew.cmu.edu", self)).toEqual({ ok: false, reason: "already-pending" });
  });

  it("allows a request to a new, valid, distinct email", () => {
    expect(canSendFriendRequest([], "new@andrew.cmu.edu", self)).toEqual({ ok: true });
  });
});

describe("respondToRequest", () => {
  it("removes the entry on reject", () => {
    const friends = [friend({ friendshipId: "f1" }), friend({ friendshipId: "f2" })];
    expect(respondToRequest(friends, "f1", "reject")).toEqual([friend({ friendshipId: "f2" })]);
  });

  it("marks the entry accepted on accept, leaving others untouched", () => {
    const friends = [friend({ friendshipId: "f1", status: "pending-incoming" }), friend({ friendshipId: "f2", status: "accepted" })];
    const result = respondToRequest(friends, "f1", "accept");
    expect(result.find((entry) => entry.friendshipId === "f1")?.status).toBe("accepted");
    expect(result.find((entry) => entry.friendshipId === "f2")?.status).toBe("accepted");
  });

  it("is a no-op for an unknown friendship id", () => {
    const friends = [friend({ friendshipId: "f1" })];
    expect(respondToRequest(friends, "missing", "accept")).toEqual(friends);
  });
});
