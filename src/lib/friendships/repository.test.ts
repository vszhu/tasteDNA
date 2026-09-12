import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseFriendshipRepository } from "./repository";
import type { FriendshipApiSummary } from "./types";

const USER_ID = "83000000-0000-4000-8000-000000000001";
const FRIEND_ID = "83000000-0000-4000-8000-000000000002";
const FRIENDSHIP_ID = "84000000-0000-4000-8000-000000000001";

function asClient(value: unknown) {
  return value as SupabaseClient;
}

function usersClient(displayName = "Ada") {
  const inIds = vi.fn().mockResolvedValue({
    data: [{ id: FRIEND_ID, display_name: displayName }],
    error: null,
  });
  const select = vi.fn(() => ({ in: inIds }));
  return { client: asClient({ from: vi.fn(() => ({ select })) }), inIds };
}

describe("SupabaseFriendshipRepository", () => {
  it("maps pending direction and counterpart display names without returning email", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: FRIENDSHIP_ID,
        requester_id: FRIEND_ID,
        addressee_id: USER_ID,
        status: "pending",
      }],
      error: null,
    });
    const inStatus = vi.fn(() => ({ order }));
    const or = vi.fn(() => ({ in: inStatus }));
    const select = vi.fn(() => ({ or }));
    const userClient = asClient({ from: vi.fn(() => ({ select })) });
    const admin = usersClient("Ada");

    const result = await new SupabaseFriendshipRepository(
      userClient,
      admin.client,
    ).listForUser(USER_ID);

    expect(result).toEqual([{
      friendshipId: FRIENDSHIP_ID,
      userId: USER_ID,
      friendUserId: FRIEND_ID,
      friendDisplayName: "Ada",
      status: "pending",
      direction: "incoming",
    }]);
    expect(result[0]).not.toHaveProperty("email");
  });

  it("uses the service-only lookup and accepts its bounded outcome", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "existing", error: null });
    const repository = new SupabaseFriendshipRepository(
      asClient({}),
      asClient({ rpc }),
    );

    await expect(repository.requestByEmail(USER_ID, "friend@example.test"))
      .resolves.toBe("existing");
    expect(rpc).toHaveBeenCalledWith("request_friendship_by_email", {
      p_requester_id: USER_ID,
      p_email: "friend@example.test",
    });
  });

  it("exposes only accepted relationships for session invitation choices", async () => {
    const repository = new SupabaseFriendshipRepository(asClient({}), asClient({}));
    const pending: FriendshipApiSummary = {
      friendshipId: FRIENDSHIP_ID,
      userId: USER_ID,
      friendUserId: FRIEND_ID,
      friendDisplayName: "Pending",
      status: "pending",
      direction: "outgoing",
    };
    const accepted: FriendshipApiSummary = {
      ...pending,
      friendshipId: "84000000-0000-4000-8000-000000000002",
      friendDisplayName: "Accepted",
      status: "accepted",
    };
    vi.spyOn(repository, "listForUser").mockResolvedValue([pending, accepted]);

    await expect(repository.listAcceptedForUser(USER_ID)).resolves.toEqual([accepted]);
  });

  it("maps a database rejection to the shared declined status", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: FRIENDSHIP_ID,
        requester_id: FRIEND_ID,
        addressee_id: USER_ID,
        status: "rejected",
      },
      error: null,
    });
    const selectAfterUpdate = vi.fn(() => ({ maybeSingle }));
    const eqStatus = vi.fn(() => ({ select: selectAfterUpdate }));
    const eqAddressee = vi.fn(() => ({ eq: eqStatus }));
    const eqId = vi.fn(() => ({ eq: eqAddressee }));
    const update = vi.fn(() => ({ eq: eqId }));
    const userClient = asClient({ from: vi.fn(() => ({ update })) });
    const admin = usersClient("Ada");

    const result = await new SupabaseFriendshipRepository(
      userClient,
      admin.client,
    ).respond(USER_ID, FRIENDSHIP_ID, "reject");

    expect(result?.status).toBe("declined");
    expect(update).toHaveBeenCalledWith({ status: "rejected" });
  });
});
