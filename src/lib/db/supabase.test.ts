import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdminClient, getSupabasePublicServerClient } from "./supabase-server";
import { isSupabaseConfigured } from "./supabase";

afterEach(() => vi.unstubAllEnvs());

function clearSupabaseKeys() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
}

describe("Supabase key configuration", () => {
  it("recognizes the recommended publishable key for browser access", () => {
    clearSupabaseKeys();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabasePublicServerClient()).not.toBeNull();
  });

  it("uses the secret key only through the server admin helper", () => {
    clearSupabaseKeys();
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");

    expect(getSupabaseAdminClient()).not.toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("temporarily supports legacy key names", () => {
    clearSupabaseKeys();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role");

    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseAdminClient()).not.toBeNull();
  });
});
