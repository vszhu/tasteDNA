import { describe, expect, it, vi } from "vitest";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import { GROUP_GOLDEN_FIXTURES } from "@/types/group.fixtures";
import {
  computeGroupSessionRecommendation,
  groupRecommendationInputHash,
} from "./compute";
import type {
  GroupRecommendationEngine,
  GroupSessionRepository,
  RecommendationSnapshot,
} from "./types";

const USER_ID = "a1000000-0000-4000-8000-000000000001";
const SESSION_ID = "a2000000-0000-4000-8000-000000000001";
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
  id: "a3000000-0000-4000-8000-000000000001",
  algorithmVersion: "stub-v1",
  inputHash: "placeholder",
  recommendation,
  computedAt: "2026-09-12T12:00:00.000Z",
};

function repository(overrides: Partial<GroupSessionRepository> = {}): GroupSessionRepository {
  return {
    create: vi.fn(),
    getForUser: vi.fn(),
    invite: vi.fn(),
    respondToInvitation: vi.fn(),
    updateMealPreferences: vi.fn(),
    replaceCandidates: vi.fn(),
    loadComputationInput: vi.fn().mockResolvedValue({
      rankingInput,
      medicationAccounts: [],
      medicationVersions: {},
      identity: { menus: ["menu-a"], members: [{ id: "a", version: 1 }] },
    }),
    persistRecommendation: vi.fn().mockResolvedValue(snapshot),
    ...overrides,
  };
}

describe("group session computation", () => {
  it("hashes equivalent object inputs deterministically", () => {
    expect(groupRecommendationInputHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      groupRecommendationInputHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("calls the engine exactly once and persists its versioned snapshot", async () => {
    const compute = vi.fn().mockReturnValue(recommendation);
    const engine: GroupRecommendationEngine = { algorithmVersion: "stub-v1", compute };
    const repo = repository();

    await expect(
      computeGroupSessionRecommendation(repo, USER_ID, SESSION_ID, engine),
    ).resolves.toBe(snapshot);
    expect(compute).toHaveBeenCalledOnce();
    expect(compute).toHaveBeenCalledWith(rankingInput);
    expect(repo.persistRecommendation).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      "stub-v1",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.objectContaining({ ...recommendation, medicationSummary: expect.objectContaining({ checkedMembers: 0 }) }),
      {},
    );
  });

  it("does not persist when the engine has no usable recommendation", async () => {
    const persistRecommendation = vi.fn();
    const repo = repository({ persistRecommendation });
    const engine: GroupRecommendationEngine = {
      algorithmVersion: "stub-v1",
      compute: vi.fn().mockReturnValue(null),
    };

    await expect(
      computeGroupSessionRecommendation(repo, USER_ID, SESSION_ID, engine),
    ).rejects.toMatchObject({ code: "missing-input" });
    expect(persistRecommendation).not.toHaveBeenCalled();
  });
});
