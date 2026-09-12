// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewSessionPage from "./new/page";
import SessionRoomPage from "./[id]/page";
import SessionResultsPage from "./[id]/results/page";
import type { GroupSessionDetail, RecommendationSnapshot } from "@/lib/group-sessions/types";
import type { SessionUser } from "@/lib/auth/types";
import { GroupSessionClientError } from "@/lib/group-sessions/client";

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
  session: { status: "signed-in", user: { id: "c1000000-0000-4000-8000-000000000001", email: "ada@example.test", displayName: "Ada" } as SessionUser | null },
  group: {
    create: vi.fn(), get: vi.fn(), invite: vi.fn(), respond: vi.fn(),
    updateMealPreferences: vi.fn(), replaceCandidates: vi.fn(), compute: vi.fn(),
  },
  friends: { list: vi.fn() },
}));

vi.mock("@/components/providers/medication-provider", () => ({ useMedications: () => ({ hydrated: true, savedAccount: null, hasUnsavedChanges: false, accountError: null }) }));
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
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("real group-session page wiring", () => {
  it.each([
    ["room", SessionRoomPage, `/sessions/${SESSION_ID}`],
    ["results", SessionResultsPage, `/sessions/${SESSION_ID}/results`],
    ["new meal", NewSessionPage, `/sessions/new?venues=${VENUE_IDS.join(",")}`],
  ] as const)("retains the %s destination when the recipient needs to sign in", (_name, Page, next) => {
    state.session = { status: "signed-out", user: null };
    render(createElement(Page));
    const href = screen.getByRole("link", { name: "Sign in" }).getAttribute("href")!;
    const url = new URL(href, "https://taste.example.test");
    expect(url.pathname).toBe("/sign-in");
    const destination = new URL(url.searchParams.get("next")!, url.origin);
    const expected = new URL(next, url.origin);
    expect(destination.pathname).toBe(expected.pathname);
    expect([...destination.searchParams]).toEqual([...expected.searchParams]);
  });

  it("lets the wrong account switch without losing the invitation", async () => {
    state.group.get.mockRejectedValue(new GroupSessionClientError("Session not found.", 404));
    render(createElement(SessionRoomPage));
    const link = await screen.findByRole("link", { name: "Switch account" });
    expect(new URL(link.getAttribute("href")!, "https://taste.example.test").searchParams.get("next")).toBe(`/sessions/${SESSION_ID}`);
    expect(screen.getByText(/Signed in as ada@example.test/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("keeps a usable visible link when the browser denies clipboard access", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://taste.example.test");
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    state.group.get.mockResolvedValue(sessionDetail());
    render(createElement(SessionRoomPage));
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Select and copy the invite link below");
    const link = screen.getByRole("textbox", { name: "Session invite link" }) as HTMLInputElement;
    expect(link.value).toBe(`https://taste.example.test/sessions/${SESSION_ID}`);
    expect(link.readOnly).toBe(true);
    expect(writeText).toHaveBeenCalledWith(link.value);
  });

  it("lets an old laptop invite open on the configured live site when local group storage is unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://taste.example.test");
    state.group.get.mockRejectedValue(new GroupSessionClientError("Group session storage is not configured.", 503));
    render(createElement(SessionRoomPage));
    const link = await screen.findByRole("link", { name: "Open this meal on the live site" });
    expect(link.getAttribute("href")).toBe(`https://taste.example.test/sessions/${SESSION_ID}`);
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });

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

  it("removes the prior account's group result immediately on an account switch", async () => {
    state.group.get.mockResolvedValueOnce({ ...sessionDetail(), latestRecommendation: snapshot() });
    const view = render(createElement(SessionResultsPage));
    await screen.findByTestId("real-result");
    state.group.get.mockImplementation(() => new Promise(() => {}));
    state.session = { status: "signed-in", user: { id: FRIEND_ID, email: "friend@example.test", displayName: "Friend" } };
    view.rerender(createElement(SessionResultsPage));
    expect(screen.queryByTestId("real-result")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });

  it("asks for recomputation when a saved medication revision invalidated the result", async () => {
    state.group.get.mockResolvedValue({ ...sessionDetail(), recommendationNeedsRefresh: true });
    render(createElement(SessionResultsPage));
    await screen.findByText("This meal needs a fresh check.");
    expect(screen.queryByTestId("real-result")).toBeNull();
    expect(screen.getByRole("link", { name: "Manage my medication settings" }).getAttribute("href")).toBe("/medications/settings");
  });
});
