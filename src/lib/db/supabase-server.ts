import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function createServerClient(key: string | undefined): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Server-only public client. Venue RLS still limits this client to active rows. */
export function getSupabasePublicServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Server-only privileged client. Never import this module from a client component. */
export function getSupabaseAdminClient() {
  return createServerClient(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
