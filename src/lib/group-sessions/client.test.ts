import { describe, expect, it, vi } from "vitest";
import { createGroupSessionClient, GroupSessionClientError } from "./client";

const USER_ID = "c1000000-0000-4000-8000-000000000001";
const SESSION_ID = "c2000000-0000-4000-8000-000000000001";
const VENUE_IDS = [
  "c3000000-0000-4000-8000-000000000001",
  "c3000000-0000-4000-8000-000000000002",
  "c3000000-0000-4000-8000-000000000003",
];
const NOW = "2026-09-12T12:00:00.000Z";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function detail() {
  return {
    session: {
      id: SESSION_ID,
      title: "Lunch",
      createdByUserId: USER_ID,
      candidateVenueIds: VENUE_IDS,
      status: "open",
      createdAt: NOW,
      updatedAt: NOW,
    },
    members: [{
      sessionId: SESSION_ID,
      userId: USER_ID,
      displayName: "Ada",
      status: "joined",
      hasMealPreferences: false,
    }],
    ownMealPreferenceState: {
      desiredTags: [],
      avoidedTags: [],
      excludedIngredients: [],
      excludedProteinTypes: [],
    },
  };
}

describe("group session browser client", () => {
  it("creates a persistent session through the authenticated route", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(detail(), 201));
    const input = {
      title: "Lunch",
      inviteeUserIds: [],
      candidateVenueIds: VENUE_IDS,
    };

    await expect(createGroupSessionClient(fetcher).create(input)).resolves.toMatchObject({
      session: { id: SESSION_ID },
    });
    expect(fetcher).toHaveBeenCalledWith("/api/group-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("sends the caller's meal state and parses the refreshed session", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(detail()));
    const state = {
      desiredTags: ["spicy" as const],
      avoidedTags: [],
      excludedIngredients: ["cilantro"],
      excludedProteinTypes: [],
    };

    await createGroupSessionClient(fetcher).updateMealPreferences(SESSION_ID, state);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/group-sessions/${SESSION_ID}/meal-preferences`,
      expect.objectContaining({ method: "PUT", body: JSON.stringify(state) }),
    );
  });

  it("surfaces the server's safe error and status", async () => {
    const client = createGroupSessionClient(
      vi.fn().mockResolvedValue(response({ error: "Accept the invitation first." }, 403)),
    );

    await expect(client.get(SESSION_ID)).rejects.toEqual(
      expect.objectContaining({
        message: "Accept the invitation first.",
        status: 403,
      }),
    );
  });

  it("rejects malformed successful responses instead of trusting browser data", async () => {
    const client = createGroupSessionClient(
      vi.fn().mockResolvedValue(response({ session: { id: "not-a-uuid" } })),
    );
    await expect(client.get(SESSION_ID)).rejects.toBeInstanceOf(GroupSessionClientError);
  });
});
