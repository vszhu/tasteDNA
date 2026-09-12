import type { AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseAuthAdapter,
  magicLinkErrorMessage,
  sessionUserFromSupabase,
} from "./supabase-adapter";

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
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Ffriends" },
    });
    await adapter.signOut();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("explains provider email limits without exposing provider messages", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      error: { code: "over_email_send_rate_limit", status: 429 },
    });
    const adapter = createSupabaseAuthAdapter(authClient({ signInWithOtp }), "http://localhost:3000");

    await expect(adapter.requestMagicLink("ada@example.test")).resolves.toEqual({
      ok: false,
      message:
        "The sign-in email limit was reached. Wait a while and try again, or configure custom SMTP in Supabase.",
    });
  });

  it("preserves the meal in both confirmation and magic-link callback URLs", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const adapter = createSupabaseAuthAdapter(authClient({ signInWithOtp, signUp }), "https://taste.example.test");
    const next = "/sessions/c2000000-0000-4000-8000-000000000001";
    await adapter.requestMagicLink("ada@example.test", next);
    await adapter.signUp("ada@example.test", "example-passphrase", next);
    for (const call of [signInWithOtp.mock.calls[0][0], signUp.mock.calls[0][0]]) {
      const callback = new URL(call.options.emailRedirectTo);
      expect(callback.origin).toBe("https://taste.example.test");
      expect(callback.pathname).toBe("/auth/callback");
      expect(callback.searchParams.get("next")).toBe(next);
    }
    await adapter.requestMagicLink("ada@example.test", "https://attacker.test");
    expect(new URL(signInWithOtp.mock.calls[1][0].options.emailRedirectTo).searchParams.get("next")).toBe("/friends");
  });

  it("maps the restricted test-mailer error", () => {
    expect(magicLinkErrorMessage({ code: "email_address_not_authorized" })).toContain(
      "test mailer",
    );
  });

  it("falls back to the email prefix when metadata has no display name", () => {
    expect(sessionUserFromSupabase(user({ user_metadata: {} })).displayName).toBe("ada");
  });
});

it("keeps email confirmation distinct from an authenticated signup", async () => {
  const signUp = vi.fn().mockResolvedValue({ data: { user: user(), session: null }, error: null });
  const adapter = createSupabaseAuthAdapter(authClient({ signUp }), "https://taste.example.test");
  await expect(adapter.signUp(" ADA@EXAMPLE.TEST ", "example-passphrase")).resolves.toEqual({ ok: true, needsConfirmation: true });
  expect(signUp).toHaveBeenCalledWith({ email: "ada@example.test", password: "example-passphrase", options: { emailRedirectTo: "https://taste.example.test/auth/callback?next=%2Ffriends" } });
  signUp.mockResolvedValue({ data: { user: user(), session: { access_token: "test-session" } }, error: null });
  await expect(adapter.signUp("ada@example.test", "example-passphrase")).resolves.toEqual({ ok: true, needsConfirmation: false });
});

it("signs in with a password without requesting another email", async () => {
  const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
  const adapter = createSupabaseAuthAdapter(authClient({ signInWithPassword }));
  await expect(adapter.signInWithPassword(" ADA@EXAMPLE.TEST ", "example-passphrase")).resolves.toEqual({ ok: true, needsConfirmation: false });
  expect(signInWithPassword).toHaveBeenCalledWith({ email: "ada@example.test", password: "example-passphrase" });
  signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "email_not_confirmed", message: "private provider detail" } });
  const result = await adapter.signInWithPassword("ada@example.test", "example-passphrase");
  expect(result).toEqual({ ok: false, message: "Confirm your email before signing in. Open the confirmation link in your inbox." });
});

it("surfaces signup mail limits and sign-out failures", async () => {
  const adapter = createSupabaseAuthAdapter(authClient({
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: { code: "over_email_send_rate_limit" } }),
    signOut: vi.fn().mockResolvedValue({ error: new Error("private provider detail") }),
  }));
  expect(await adapter.signUp("ada@example.test", "example-passphrase")).toEqual({ ok: false, message: magicLinkErrorMessage({ code: "over_email_send_rate_limit" }) });
  await expect(adapter.signOut()).rejects.toThrow("We couldn't sign you out.");
});

it("does not restore a stale user after sign-out or unsubscribe", async () => {
  vi.useFakeTimers();
  try {
    let event: (event: string) => void = () => {};
    let finish: (value: unknown) => void = () => {};
    const getUser = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const unsubscribe = vi.fn();
    const listener = vi.fn();
    const adapter = createSupabaseAuthAdapter(authClient({ getUser, onAuthStateChange: (callback: typeof event) => {
      event = callback;
      return { data: { subscription: { unsubscribe } } };
    } }));
    const stop = adapter.subscribe(listener);
    event("SIGNED_IN");
    await vi.runAllTimersAsync();
    event("SIGNED_OUT");
    finish({ data: { user: user() }, error: null });
    await Promise.resolve();
    expect(listener.mock.calls).toEqual([[null]]);
    event("SIGNED_IN");
    stop();
    await vi.runAllTimersAsync();
    expect(getUser).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
