// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FriendsPage from "./page";
import type { FriendshipApiSummary } from "@/lib/friendships/types";

const state = vi.hoisted(() => ({
  session: { status: "signed-in", user: { id: "account-a", email: "ada@example.test", displayName: "Ada" } },
  list: vi.fn(), request: vi.fn(), respond: vi.fn(),
}));
vi.mock("@/components/providers/medication-provider", () => ({ useMedications: () => ({ hydrated: true, savedAccount: null, hasUnsavedChanges: false, accountError: null }) }));
vi.mock("@/components/providers/session-provider", () => ({ useSession: () => state.session }));
vi.mock("@/lib/friendships/client", async (original) => ({
  ...await original<typeof import("@/lib/friendships/client")>(),
  createFriendshipClient: () => ({ list: state.list, request: state.request, respond: state.respond }),
}));
const incoming: FriendshipApiSummary = { friendshipId: "request-1", userId: "account-a", friendUserId: "account-b", friendDisplayName: "Ben", status: "pending", direction: "incoming" };
beforeEach(() => {
  vi.clearAllMocks();
  state.session = { status: "signed-in", user: { id: "account-a", email: "ada@example.test", displayName: "Ada" } };
  state.list.mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("loads real incoming requests, accepts, and reloads the relationship", async () => {
  state.list.mockResolvedValueOnce([incoming]).mockResolvedValue([{ ...incoming, status: "accepted" }]);
  state.respond.mockResolvedValue({ ...incoming, status: "accepted" });
  render(createElement(FriendsPage));
  fireEvent.click(await screen.findByRole("button", { name: "Accept Ben" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Accept Ben" })).toBeNull());
  expect(state.respond).toHaveBeenCalledWith("request-1", "accept");
  expect(await screen.findByText("Ben")).toBeTruthy();
  expect(screen.getByText("Friends")).toBeTruthy();
});

it("declines an incoming request and removes it after the server responds", async () => {
  state.list.mockResolvedValueOnce([incoming]).mockResolvedValue([]);
  state.respond.mockResolvedValue({ ...incoming, status: "declined" });
  render(createElement(FriendsPage));
  fireEvent.click(await screen.findByRole("button", { name: "Decline Ben" }));
  await waitFor(() => expect(screen.queryByText("Ben")).toBeNull());
  expect(state.respond).toHaveBeenCalledWith("request-1", "reject");
});

it("sends an email request through the API and displays the neutral result", async () => {
  state.request.mockResolvedValue("If that email has an account, they'll see your request.");
  render(createElement(FriendsPage));
  await screen.findByText(/No friends yet/);
  fireEvent.change(screen.getByRole("textbox", { name: "Friend’s email" }), { target: { value: "ben@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Add friend" }));
  expect(await screen.findByRole("status")).toBeTruthy();
  expect(state.request).toHaveBeenCalledWith("ben@example.test");
  await waitFor(() => expect(state.list).toHaveBeenCalledTimes(2));
});

it("does not turn a failed load into an empty friend list and lets the user retry", async () => {
  state.list.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([incoming]);
  render(createElement(FriendsPage));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/No friends yet/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Refresh friends" }));
  expect(await screen.findByText("Ben")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("aborts the previous account's read and never displays its late result", async () => {
  let finish: (rows: FriendshipApiSummary[]) => void = () => {};
  state.list.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue([]);
  const view = render(createElement(FriendsPage));
  const oldSignal = state.list.mock.calls[0][0] as AbortSignal;
  state.session = { status: "signed-in", user: { id: "account-b", email: "ben@example.test", displayName: "Ben" } };
  view.rerender(createElement(FriendsPage));
  await screen.findByText(/No friends yet/);
  expect(oldSignal.aborted).toBe(true);
  await act(async () => { finish([incoming]); });
  expect(screen.queryByText("Ben")).toBeNull();
  expect(screen.getByText("Signed in as ben@example.test")).toBeTruthy();
});

it("refreshes on window focus so the sender can see an acceptance", async () => {
  state.list.mockResolvedValueOnce([{ ...incoming, direction: "outgoing" }]).mockResolvedValue([{ ...incoming, status: "accepted" }]);
  render(createElement(FriendsPage));
  await screen.findByText("Pending");
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByText("Pending")).toBeNull());
  expect(screen.getByText("Friends")).toBeTruthy();
});
