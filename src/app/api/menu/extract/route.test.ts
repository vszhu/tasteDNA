import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

function textRequest(venueId?: string) {
  const body = new FormData();
  body.set("text", "Miso Ramen — mushroom, egg  18");
  if (venueId) body.set("venueId", venueId);
  return new Request("http://localhost:3000/api/menu/extract", { method: "POST", body });
}

describe("POST /api/menu/extract shared-menu compatibility", () => {
  it("preserves anonymous one-off text decoding when no venue is supplied", async () => {
    vi.stubEnv("TASTEDNA_DEMO_MODE", "true");
    const response = await POST(textRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(payload).not.toHaveProperty("sharedMenu");
  });

  it("rejects malformed venue IDs before authentication or extraction", async () => {
    const response = await POST(textRequest("not-a-uuid"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Choose a valid venue before sharing this menu.",
    });
  });
});
