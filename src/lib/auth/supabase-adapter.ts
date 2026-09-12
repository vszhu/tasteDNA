import type { AuthError, AuthUser, SupabaseClient } from "@supabase/supabase-js";
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

export function magicLinkErrorMessage(error: Pick<AuthError, "code">): string {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "The sign-in email limit was reached. Wait a while and try again, or configure custom SMTP in Supabase.";
    case "over_request_rate_limit":
      return "Too many sign-in attempts were made. Wait a few minutes and try again.";
    case "email_address_not_authorized":
      return "Supabase's test mailer cannot send to this address. Add custom SMTP or use an authorized project-team email.";
    case "otp_disabled":
    case "email_provider_disabled":
      return "Email sign-in is disabled in Supabase project settings.";
    default:
      return "We couldn't send a sign-in link. Please try again.";
  }
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

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Supabase magic-link request failed", {
            code: error.code,
            status: error.status,
          });
        }
        return { ok: false, message: magicLinkErrorMessage(error) };
      }

      return { ok: true };
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
