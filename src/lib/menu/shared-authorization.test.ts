import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { authorizeSharedMenuUpload, SharedMenuAuthorizationError } from "./shared-authorization";

function clientWith(authResult: unknown, venueResult: unknown) {
  const venueQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(venueResult),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue(authResult) },
    from: vi.fn(() => venueQuery),
  } as unknown as SupabaseClient;
}

describe("shared menu upload authorization", () => {
  it("rejects an invalid or expired session before venue mutation", async () => {
    const client = clientWith(
      { data: { user: null }, error: new Error("expired") },
      { data: { id: "unused" }, error: null },
    );
    await expect(authorizeSharedMenuUpload(client, "20000000-0000-0000-0000-000000000001"))
      .rejects.toMatchObject({ status: 401 } satisfies Partial<SharedMenuAuthorizationError>);
  });

  it("rejects inactive or unknown venues", async () => {
    const client = clientWith(
      { data: { user: { id: "user", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "now" } }, error: null },
      { data: null, error: null },
    );
    await expect(authorizeSharedMenuUpload(client, "20000000-0000-0000-0000-000000000001"))
      .rejects.toMatchObject({ status: 403 } satisfies Partial<SharedMenuAuthorizationError>);
  });
});
