import type { AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthAdapter, sessionUserFromSupabase } from "./supabase-adapter";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "90000000-0000-0000-0000-000000000001",
    app_metadata: {},
    user_metadata: { display_name: "Ada" },
    aud: "authenticated",
    created_at: "2026-09-12T00:00:00.000Z",
    email: "ada@example.test",
    ...overrides,
  };
}

function authClient(auth: object) {
  return { auth } as unknown as SupabaseClient;
}

describe("Supabase auth adapter", () => {
  it("maps a verified current user", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: user() }, error: null });
    const adapter = createSupabaseAuthAdapter(authClient({ getUser }), "http://localhost:3000");

    await expect(adapter.getCurrentUser()).resolves.toEqual({
      id: "90000000-0000-0000-0000-000000000001",
      email: "ada@example.test",
      displayName: "Ada",
    });
  });

  it("treats expired or invalid sessions as signed out", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    const adapter = createSupabaseAuthAdapter(authClient({ getUser }), "http://localhost:3000");
    await expect(adapter.getCurrentUser()).resolves.toBeNull();
  });

  it("uses the callback URL for magic links and signs out through Supabase", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const adapter = createSupabaseAuthAdapter(
      authClient({ signInWithOtp, signOut }),
      "http://localhost:3000",
    );

    await expect(adapter.requestMagicLink("ada@example.test")).resolves.toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ada@example.test",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=/friends" },
    });
    await adapter.signOut();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("falls back to the email prefix when metadata has no display name", () => {
    expect(sessionUserFromSupabase(user({ user_metadata: {} })).displayName).toBe("ada");
  });
});
