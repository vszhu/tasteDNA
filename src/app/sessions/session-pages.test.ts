// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewSessionPage from "./new/page";
import SessionRoomPage from "./[id]/page";
import SessionResultsPage from "./[id]/results/page";
import type { GroupSessionDetail, RecommendationSnapshot } from "@/lib/group-sessions/types";

const USER_ID = "c1000000-0000-4000-8000-000000000001";
const FRIEND_ID = "c1000000-0000-4000-8000-000000000002";
const SESSION_ID = "c2000000-0000-4000-8000-000000000001";
const VENUE_IDS = [
  "c3000000-0000-4000-8000-000000000001",
  "c3000000-0000-4000-8000-000000000002",
  "c3000000-0000-4000-8000-000000000003",
];
const NOW = "2026-09-12T12:00:00.000Z";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  search: new URLSearchParams(),
  session: { status: "signed-in", user: { id: "c1000000-0000-4000-8000-000000000001", email: "ada@example.test", displayName: "Ada" } },
  group: {
    create: vi.fn(), get: vi.fn(), invite: vi.fn(), respond: vi.fn(),
    updateMealPreferences: vi.fn(), replaceCandidates: vi.fn(), compute: vi.fn(),
  },
  friends: { list: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
  useParams: () => ({ id: SESSION_ID }),
  useSearchParams: () => state.search,
}));
vi.mock("@/components/providers/session-provider", () => ({ useSession: () => state.session }));
vi.mock("@/lib/group-sessions/client", async (original) => ({
  ...await original<typeof import("@/lib/group-sessions/client")>(),
  createGroupSessionClient: () => state.group,
}));
vi.mock("@/lib/friendships/client", () => ({
  createFriendshipClient: () => state.friends,
  FriendshipClientError: class FriendshipClientError extends Error {},
}));
vi.mock("@/components/map/use-venues", () => ({
  useVenues: () => ({
    loadState: "ready",
    usingFallback: false,
    venues: VENUE_IDS.map((id, index) => ({
      id,
      name: `Venue ${index + 1}`,
      location: { latitude: 40.44, longitude: -79.94 },
      menuFreshness: "fresh",
      menuItems: [{ id: `item-${index}`, menuId: `menu-${index}`, menuOrder: 0, dish: { id: `dish-${index}` } }],
    })),
  }),
}));
vi.mock("@/components/map/campus-map", () => ({ CampusMap: () => createElement("div", null, "Map") }));
vi.mock("@/components/map/venue-card", () => ({
  VenueCard: ({ venue, onToggle }: { venue: { id: string; name: string }; onToggle: (id: string) => void }) =>
    createElement("button", { type: "button", onClick: () => onToggle(venue.id) }, venue.name),
}));
vi.mock("@/components/group/group-results-view", () => ({
  GroupResultsView: ({ recommendation }: { recommendation: { winner: { name: string } } }) =>
    createElement("div", { "data-testid": "real-result" }, recommendation.winner.name),
}));

function sessionDetail(memberStatus: "invited" | "joined" | "responded" = "joined"): GroupSessionDetail {
  return {
    session: {
      id: SESSION_ID,
      title: "Friday lunch",
      createdByUserId: memberStatus === "invited" ? FRIEND_ID : USER_ID,
      candidateVenueIds: VENUE_IDS,
      status: "open",
      createdAt: NOW,
      updatedAt: NOW,
    },
    members: [{
      sessionId: SESSION_ID,
      userId: USER_ID,
      displayName: "Ada",
      status: memberStatus,
      hasMealPreferences: memberStatus === "responded",
    }],
    ...(memberStatus === "invited" ? {} : {
      ownMealPreferenceState: {
        desiredTags: [], avoidedTags: [], excludedIngredients: [], excludedProteinTypes: [],
      },
    }),
  };
}

function snapshot(): RecommendationSnapshot {
  return {
    id: "c4000000-0000-4000-8000-000000000001",
    algorithmVersion: "fair-group-v1.0.0",
    inputHash: "hash",
    computedAt: NOW,
    recommendation: {
      sessionId: SESSION_ID,
      winner: { id: VENUE_IDS[0], name: "Real winner", location: { latitude: 40.44, longitude: -79.94 }, menuFreshness: "fresh" },
      groupScore: 80,
      groupMeanUtility: 82,
      worstMemberUtility: 76,
      miseryFloor: 45,
      compromiseRequired: false,
      assignments: [],
      restaurantUtilities: [],
      venueScores: [],
      explanationFacts: [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.search = new URLSearchParams(`venues=${VENUE_IDS.join(",")}`);
  state.session = { status: "signed-in", user: { id: USER_ID, email: "ada@example.test", displayName: "Ada" } };
  state.friends.list.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("real group-session page wiring", () => {
  it("creates through the API and navigates to the persisted UUID", async () => {
    state.group.create.mockResolvedValue(sessionDetail());
    render(createElement(NewSessionPage));
    fireEvent.click(await screen.findByRole("button", { name: /Create session/ }));
    await waitFor(() => expect(state.group.create).toHaveBeenCalledWith({
      title: "Group lunch",
      candidateVenueIds: VENUE_IDS,
      inviteeUserIds: [],
    }));
    expect(state.push).toHaveBeenCalledWith(`/sessions/${SESSION_ID}`);
  });

  it("accepts a real invitation and refreshes the room", async () => {
    state.group.get.mockResolvedValueOnce(sessionDetail("invited")).mockResolvedValue(sessionDetail("joined"));
    state.group.respond.mockResolvedValue(undefined);
    render(createElement(SessionRoomPage));
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(state.group.respond).toHaveBeenCalledWith(SESSION_ID, "accept"));
    expect(await screen.findByText("Your meal check-in")).toBeTruthy();
  });

  it("renders the saved server recommendation instead of a golden fixture", async () => {
    state.group.get.mockResolvedValue({ ...sessionDetail(), latestRecommendation: snapshot() });
    render(createElement(SessionResultsPage));
    expect((await screen.findByTestId("real-result")).textContent).toBe("Real winner");
    expect(screen.queryByText(/sample scenario/i)).toBeNull();
  });
});
