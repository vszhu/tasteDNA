import type { AuthUser, SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "./types";

export type MagicLinkResult =
  | { ok: true }
  | { ok: false; message: string };

export interface AuthAdapter {
  getCurrentUser(): Promise<SessionUser | null>;
  requestMagicLink(email: string): Promise<MagicLinkResult>;
  signOut(): Promise<void>;
  subscribe(listener: (user: SessionUser | null) => void): () => void;
}

export function sessionUserFromSupabase(user: AuthUser): SessionUser {
  const email = user.email ?? "";
  const displayName =
    (typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()) ||
    email.split("@")[0] ||
    "TasteDNA user";

  return { id: user.id, email, displayName };
}

export function createSupabaseAuthAdapter(
  client: SupabaseClient,
  redirectOrigin = typeof window === "undefined" ? "" : window.location.origin,
): AuthAdapter {
  return {
    async getCurrentUser() {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return sessionUserFromSupabase(data.user);
    },

    async requestMagicLink(email) {
      const emailRedirectTo = redirectOrigin
        ? `${redirectOrigin}/auth/callback?next=/friends`
        : undefined;
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });

      return error
        ? { ok: false, message: "We couldn't send a sign-in link. Please try again." }
        : { ok: true };
    },

    async signOut() {
      await client.auth.signOut();
    },

    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange(
        (event) => {
          if (event === "SIGNED_OUT") {
            listener(null);
            return;
          }

          // Supabase advises keeping this callback synchronous. Verify the
          // user outside it instead of trusting the locally decoded session.
          setTimeout(() => {
            void client.auth.getUser().then(({ data: verified, error }) => {
              listener(error || !verified.user ? null : sessionUserFromSupabase(verified.user));
            });
          }, 0);
        },
      );
      return () => data.subscription.unsubscribe();
    },
  };
}
