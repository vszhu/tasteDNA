import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/venues", () => {
  it("serves the checked-in cache without database credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await GET();
    const venues = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-TasteDNA-Venue-Source")).toBe("fixture");
    expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate");
    expect(venues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        menuItems: [],
        menuFreshness: "unknown",
      }),
    ]));
  });
});
