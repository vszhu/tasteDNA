// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/types";
import { SessionProvider, useSession } from "./session-provider";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), ensurePublicUser: vi.fn(), unsubscribe: vi.fn(),
  listener: null as ((user: SessionUser | null) => void) | null,
}));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseBrowserClient: () => ({ auth: {} }) }));
vi.mock("@/lib/auth/bootstrap", () => ({ ensurePublicUser: mocks.ensurePublicUser }));
vi.mock("@/lib/auth/supabase-adapter", () => ({ createSupabaseAuthAdapter: () => ({
  getCurrentUser: mocks.getCurrentUser,
  subscribe: (listener: typeof mocks.listener) => { mocks.listener = listener; return mocks.unsubscribe; },
}) }));
const ada: SessionUser = { id: "account-a", email: "ada@example.test", displayName: "Ada" };
const ben: SessionUser = { id: "account-b", email: "ben@example.test", displayName: "Ben" };
function Probe() { const { user, status } = useSession(); return createElement("output", { "data-testid": "session" }, `${status}:${user?.id ?? "none"}`); }
function mount() { return render(createElement(SessionProvider, null, createElement(Probe))); }
beforeEach(() => { vi.clearAllMocks(); mocks.getCurrentUser.mockResolvedValue(null); mocks.ensurePublicUser.mockResolvedValue(undefined); });
afterEach(cleanup);

it("creates the public profile on password sign-in before exposing the user", async () => {
  let complete: () => void = () => {};
  mocks.ensurePublicUser.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
  mount();
  await waitFor(() => expect(screen.getByTestId("session").textContent).toBe("signed-out:none"));
  await act(async () => { mocks.listener!(ada); });
  expect(mocks.ensurePublicUser).toHaveBeenCalledWith(expect.anything(), ada);
  expect(screen.getByTestId("session").textContent).toBe("signed-out:none");
  await act(async () => { complete(); });
  expect(screen.getByTestId("session").textContent).toBe("signed-in:account-a");
});

it("does not let an initial account lookup overwrite a newer account", async () => {
  let finish: (user: SessionUser) => void = () => {};
  mocks.getCurrentUser.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  mount();
  await act(async () => { mocks.listener!(ben); });
  expect(screen.getByTestId("session").textContent).toBe("signed-in:account-b");
  await act(async () => { finish(ada); });
  expect(screen.getByTestId("session").textContent).toBe("signed-in:account-b");
  expect(mocks.ensurePublicUser).not.toHaveBeenCalledWith(expect.anything(), ada);
});

it("does not restore an account when its profile creation finishes after sign-out", async () => {
  let complete: () => void = () => {};
  mocks.ensurePublicUser.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
  mount();
  await act(async () => { mocks.listener!(ada); });
  await act(async () => { mocks.listener!(null); });
  await act(async () => { complete(); });
  expect(screen.getByTestId("session").textContent).toBe("signed-out:none");
});
