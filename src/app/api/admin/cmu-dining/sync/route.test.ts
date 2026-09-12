import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

function request(token?: string) {
  return new Request("http://localhost/api/admin/cmu-dining/sync", {
    method: "POST",
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  });
}

describe("POST /api/admin/cmu-dining/sync", () => {
  it("fails closed when the route secret is missing", async () => {
    vi.stubEnv("CMU_DINING_SYNC_SECRET", "");
    expect((await POST(request())).status).toBe(503);
  });

  it("rejects a caller without the configured bearer secret", async () => {
    vi.stubEnv("CMU_DINING_SYNC_SECRET", "expected-secret");
    expect((await POST(request("wrong-secret"))).status).toBe(401);
  });

  it("requires a server-only Supabase secret before syncing", async () => {
    vi.stubEnv("CMU_DINING_SYNC_SECRET", "expected-secret");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await POST(request("expected-secret"))).status).toBe(503);
  });
});
