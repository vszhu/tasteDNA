import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const state = vi.hoisted(() => ({ client: vi.fn(), bootstrap: vi.fn(), exchange: vi.fn() }));
vi.mock("@/lib/db/supabase-auth-server", () => ({ createAuthenticatedSupabaseServerClient: state.client }));
vi.mock("@/lib/auth/bootstrap", () => ({ ensurePublicUser: state.bootstrap }));

const next = "/sessions/c2000000-0000-4000-8000-000000000001";
function request(destination = next) {
  return new NextRequest(`https://taste.example.test/auth/callback?${new URLSearchParams({ code: "test-code", next: destination })}`);
}
beforeEach(() => { vi.clearAllMocks(); state.client.mockResolvedValue({ auth: { exchangeCodeForSession: state.exchange } }); });

it("returns verified email sign-in to the invitation", async () => {
  state.exchange.mockResolvedValue({ data: { user: { id: "account-a", email: "ada@example.test", user_metadata: {} } }, error: null });
  const response = await GET(request());
  expect(response.headers.get("location")).toBe(`https://taste.example.test${next}`);
  expect(state.bootstrap).toHaveBeenCalledOnce();
});

it("keeps the invitation for a password retry after an expired email link", async () => {
  state.exchange.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
  const response = await GET(request());
  const location = new URL(response.headers.get("location")!);
  expect(location.pathname).toBe("/sign-in");
  expect(location.searchParams.get("next")).toBe(next);
  expect(location.searchParams.get("error")).toBe("invalid-link");
  expect(state.bootstrap).not.toHaveBeenCalled();
});

it("retains a safe destination even when auth is unavailable", async () => {
  state.client.mockResolvedValue(null);
  const response = await GET(request("/\\attacker.test"));
  const location = new URL(response.headers.get("location")!);
  expect(location.origin).toBe("https://taste.example.test");
  expect(location.searchParams.get("next")).toBe("/friends");
  expect(location.searchParams.get("error")).toBe("not-configured");
});
