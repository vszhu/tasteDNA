import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseGroupSessionRepository } from "./repository";

const USER_ID = "c1000000-0000-4000-8000-000000000001";
const FRIEND_ID = "c1000000-0000-4000-8000-000000000002";
const SESSION_ID = "c2000000-0000-4000-8000-000000000001";
const VENUE_ID = "c3000000-0000-4000-8000-000000000001";
const NOW = "2026-09-12T12:00:00.000Z";

function query(data: unknown, singleData: unknown = data) {
  const result = { data, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "or", "order", "limit", "update", "upsert", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: singleData, error: null });
  builder.single = vi.fn().mockResolvedValue({ data: singleData, error: null });
  builder.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function asClient(from: (table: string) => unknown): SupabaseClient {
  return { from: vi.fn(from) } as unknown as SupabaseClient;
}

describe("SupabaseGroupSessionRepository", () => {
  it("returns only the caller's meal-state JSON while exposing roster readiness", async () => {
    const session = {
      id: SESSION_ID,
      creator_id: USER_ID,
      name: "Friday lunch",
      scheduled_for: null,
      status: "planning",
      created_at: NOW,
      updated_at: NOW,
    };
    const members = [
      {
        session_id: SESSION_ID,
        user_id: USER_ID,
        status: "accepted",
        accepted_at: NOW,
        declined_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        session_id: SESSION_ID,
        user_id: FRIEND_ID,
        status: "accepted",
        accepted_at: NOW,
        declined_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ];
    const ownPreference = {
      user_id: USER_ID,
      state_version: 2,
      preference_state: {
        desiredTags: ["spicy"],
        avoidedTags: [],
        excludedIngredients: ["private ingredient"],
        excludedProteinTypes: [],
      },
      updated_at: NOW,
    };

    const userClient = asClient((table) => {
      if (table === "group_sessions") return query([], session);
      if (table === "group_session_members") return query(members);
      if (table === "group_session_candidates") return query([{ venue_id: VENUE_ID }]);
      if (table === "group_session_meal_preferences") return query([], ownPreference);
      if (table === "group_recommendation_results") return query([], null);
      throw new Error(`Unexpected user table ${table}`);
    });
    const adminClient = asClient((table) => {
      if (table === "group_session_meal_preferences") {
        return query([{
          user_id: USER_ID,
          state_version: 2,
          updated_at: NOW,
        }]);
      }
      if (table === "users") {
        return query([
          { id: USER_ID, display_name: "Creator" },
          { id: FRIEND_ID, display_name: "Friend" },
        ]);
      }
      throw new Error(`Unexpected admin table ${table}`);
    });

    const detail = await new SupabaseGroupSessionRepository(
      userClient,
      adminClient,
    ).getForUser(USER_ID, SESSION_ID);

    expect(detail).toMatchObject({
      session: { status: "open", candidateVenueIds: [VENUE_ID] },
      members: [
        { userId: USER_ID, status: "responded", hasMealPreferences: true },
        { userId: FRIEND_ID, status: "joined", hasMealPreferences: false },
      ],
      ownMealPreferenceState: { excludedIngredients: ["private ingredient"] },
    });
    expect(JSON.stringify(detail?.members)).not.toContain("private ingredient");
    expect(detail?.members.every((member) => !("mealPreferenceState" in member))).toBe(true);
  });

  it("passes the verified caller identity to the atomic create function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: SESSION_ID, error: null });
    const repository = new SupabaseGroupSessionRepository(
      asClient(() => query([])),
      { rpc } as unknown as SupabaseClient,
    );
    vi.spyOn(repository, "getForUser").mockResolvedValue({
      session: {
        id: SESSION_ID,
        title: "Lunch",
        createdByUserId: USER_ID,
        candidateVenueIds: [VENUE_ID],
        status: "open",
        createdAt: NOW,
        updatedAt: NOW,
      },
      members: [],
    });

    await repository.create(USER_ID, {
      title: "Lunch",
      inviteeUserIds: [FRIEND_ID],
      candidateVenueIds: [VENUE_ID],
    });

    expect(rpc).toHaveBeenCalledWith("create_group_session", {
      p_creator_id: USER_ID,
      p_name: "Lunch",
      p_scheduled_for: null,
      p_invitee_ids: [FRIEND_ID],
      p_candidate_venue_ids: [VENUE_ID],
    });
  });
});
