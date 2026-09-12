import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import {
  computeGroupSession,
  createGroupSession,
  inviteGroupSessionMember,
  readGroupSession,
  replaceGroupSessionCandidates,
  respondToGroupSessionInvitation,
  updateGroupSessionMealPreferences,
} from "./http";
import type { GroupSessionRequestContext } from "./server-context";
import {
  GroupSessionError,
  type GroupRecommendationEngine,
  type GroupSessionDetail,
  type GroupSessionRepository,
  type RecommendationSnapshot,
} from "./types";

const USER_ID = "b1000000-0000-4000-8000-000000000001";
const FRIEND_ID = "b1000000-0000-4000-8000-000000000002";
const SESSION_ID = "b2000000-0000-4000-8000-000000000001";
const VENUE_IDS = [
  "b3000000-0000-4000-8000-000000000001",
  "b3000000-0000-4000-8000-000000000002",
  "b3000000-0000-4000-8000-000000000003",
];
const EMPTY_PREFERENCES = {
  desiredTags: [],
  avoidedTags: [],
  excludedIngredients: [],
  excludedProteinTypes: [],
};

const detail: GroupSessionDetail = {
  session: {
    id: SESSION_ID,
    title: "Friday lunch",
    createdByUserId: USER_ID,
    candidateVenueIds: VENUE_IDS,
    status: "open",
    createdAt: "2026-09-12T12:00:00.000Z",
    updatedAt: "2026-09-12T12:00:00.000Z",
  },
  members: [{
    sessionId: SESSION_ID,
    userId: USER_ID,
    displayName: "Creator",
    status: "joined",
    hasMealPreferences: false,
  }],
  ownMealPreferenceState: EMPTY_PREFERENCES,
};

const fixture = GROUP_GOLDEN_FIXTURES[0];
const rankingInput = {
  ...fixture,
  session: { ...fixture.session, id: SESSION_ID, createdByUserId: USER_ID },
  members: fixture.members.map((entry) => ({
    ...entry,
    member: { ...entry.member, sessionId: SESSION_ID },
  })),
};
const recommendation = computeGroupRecommendation(rankingInput)!;
const snapshot: RecommendationSnapshot = {
  id: "b4000000-0000-4000-8000-000000000001",
  algorithmVersion: "stub-v1",
  inputHash: "a".repeat(64),
  recommendation,
  computedAt: "2026-09-12T12:00:00.000Z",
};

function repository(overrides: Partial<GroupSessionRepository> = {}): GroupSessionRepository {
  return {
    create: vi.fn().mockResolvedValue(detail),
    getForUser: vi.fn().mockResolvedValue(detail),
    invite: vi.fn().mockResolvedValue(detail),
    respondToInvitation: vi.fn().mockResolvedValue({
      sessionId: SESSION_ID,
      userId: FRIEND_ID,
      displayName: "Friend",
      status: "joined",
      hasMealPreferences: false,
    }),
    updateMealPreferences: vi.fn().mockResolvedValue(detail),
    replaceCandidates: vi.fn().mockResolvedValue(detail),
    loadComputationInput: vi.fn().mockResolvedValue({
      rankingInput,
      medicationAccounts: [],
      medicationVersions: {},
      identity: { sessionId: SESSION_ID },
    }),
    persistRecommendation: vi.fn().mockResolvedValue(snapshot),
    ...overrides,
  };
}

function context(repo: GroupSessionRepository) {
  return async (): Promise<GroupSessionRequestContext> => ({ userId: USER_ID, repository: repo });
}

function jsonRequest(path: string, method: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("group session HTTP handlers", () => {
  it("creates a session from validated invitees and candidates", async () => {
    const create = vi.fn().mockResolvedValue(detail);
    const response = await createGroupSession(
      jsonRequest("/api/group-sessions", "POST", {
        title: " Friday lunch ",
        inviteeUserIds: [FRIEND_ID],
        candidateVenueIds: VENUE_IDS,
      }),
      context(repository({ create })),
    );

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(USER_ID, {
      title: "Friday lunch",
      inviteeUserIds: [FRIEND_ID],
      candidateVenueIds: VENUE_IDS,
    });
  });

  it("rejects malformed candidate sets before authentication or storage", async () => {
    const contextFactory = vi.fn();
    const response = await createGroupSession(
      jsonRequest("/api/group-sessions", "POST", {
        title: "Lunch",
        candidateVenueIds: VENUE_IDS.slice(0, 2),
      }),
      contextFactory,
    );

    expect(response.status).toBe(400);
    expect(contextFactory).not.toHaveBeenCalled();
  });

  it("does not distinguish an inaccessible session from a missing session", async () => {
    const response = await readGroupSession(
      SESSION_ID,
      context(repository({ getForUser: vi.fn().mockResolvedValue(null) })),
    );
    expect(response.status).toBe(404);
  });

  it("maps creator-only invitation failures to forbidden", async () => {
    const invite = vi.fn().mockRejectedValue(
      new GroupSessionError("forbidden", "Only the creator can invite members."),
    );
    const response = await inviteGroupSessionMember(
      jsonRequest(`/api/group-sessions/${SESSION_ID}/invitations`, "POST", {
        userId: FRIEND_ID,
      }),
      SESSION_ID,
      context(repository({ invite })),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the creator can invite members.",
    });
  });

  it("lets an invitee accept only through their own repository identity", async () => {
    const respondToInvitation = vi.fn().mockResolvedValue({
      sessionId: SESSION_ID,
      userId: USER_ID,
      displayName: "Invitee",
      status: "joined",
      hasMealPreferences: false,
    });
    const response = await respondToGroupSessionInvitation(
      jsonRequest(`/api/group-sessions/${SESSION_ID}/invitations`, "PATCH", {
        action: "accept",
      }),
      SESSION_ID,
      context(repository({ respondToInvitation })),
    );

    expect(response.status).toBe(200);
    expect(respondToInvitation).toHaveBeenCalledWith(USER_ID, SESSION_ID, "accept");
  });

  it("validates and stores only the caller's meal preference state", async () => {
    const updateMealPreferences = vi.fn().mockResolvedValue(detail);
    const response = await updateGroupSessionMealPreferences(
      jsonRequest(`/api/group-sessions/${SESSION_ID}/meal-preferences`, "PUT", {
        ...EMPTY_PREFERENCES,
        desiredTags: ["spicy"],
        maxPrice: 18,
      }),
      SESSION_ID,
      context(repository({ updateMealPreferences })),
    );

    expect(response.status).toBe(200);
    expect(updateMealPreferences).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      { ...EMPTY_PREFERENCES, desiredTags: ["spicy"], maxPrice: 18 },
    );
  });

  it("rejects contradictory meal tags", async () => {
    const contextFactory = vi.fn();
    const response = await updateGroupSessionMealPreferences(
      jsonRequest(`/api/group-sessions/${SESSION_ID}/meal-preferences`, "PUT", {
        ...EMPTY_PREFERENCES,
        desiredTags: ["spicy"],
        avoidedTags: ["spicy"],
      }),
      SESSION_ID,
      contextFactory,
    );

    expect(response.status).toBe(400);
    expect(contextFactory).not.toHaveBeenCalled();
  });

  it("routes candidate replacement through the authenticated creator identity", async () => {
    const replaceCandidates = vi.fn().mockResolvedValue(detail);
    const response = await replaceGroupSessionCandidates(
      jsonRequest(`/api/group-sessions/${SESSION_ID}/candidates`, "PUT", {
        venueIds: VENUE_IDS,
      }),
      SESSION_ID,
      context(repository({ replaceCandidates })),
    );
    expect(response.status).toBe(200);
    expect(replaceCandidates).toHaveBeenCalledWith(USER_ID, SESSION_ID, VENUE_IDS);
  });

  it("computes once through an injected engine and returns only the derived snapshot", async () => {
    const engine: GroupRecommendationEngine = {
      algorithmVersion: "stub-v1",
      compute: vi.fn().mockReturnValue(recommendation),
    };
    const response = await computeGroupSession(
      SESSION_ID,
      context(repository()),
      engine,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ result: snapshot });
    expect(engine.compute).toHaveBeenCalledOnce();
    expect(JSON.stringify(body).toLowerCase()).not.toContain("profile");
  });
});
