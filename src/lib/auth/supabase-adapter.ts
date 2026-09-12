import type { AuthError, AuthUser, SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "./types";
import { safeNextPath } from "./callback";

export type MagicLinkResult =
  | { ok: true }
  | { ok: false; message: string };

export type PasswordAuthResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; message: string };

export interface AuthAdapter {
  getCurrentUser(): Promise<SessionUser | null>;
  requestMagicLink(email: string, next?: string): Promise<MagicLinkResult>;
  signInWithPassword(email: string, password: string): Promise<PasswordAuthResult>;
  signUp(email: string, password: string, next?: string): Promise<PasswordAuthResult>;
  signOut(): Promise<void>;
  subscribe(listener: (user: SessionUser | null) => void): () => void;
}

function passwordErrorMessage(error: Pick<AuthError, "code">): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password didn't work. Check your details or use an email link.";
    case "email_not_confirmed":
      return "Confirm your email before signing in. Open the confirmation link in your inbox.";
    case "weak_password":
      return "Choose a stronger password that meets this project's password requirements.";
    case "user_already_exists":
      return "We couldn't create this account. Try signing in or using an email link.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
    case "email_address_not_authorized":
    case "email_provider_disabled":
      return magicLinkErrorMessage(error);
    default:
      return "We couldn't complete sign-in. Please try again.";
  }
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
  const emailRedirectTo = (next?: string) => redirectOrigin
    ? `${redirectOrigin}/auth/callback?${new URLSearchParams({ next: safeNextPath(next ?? null) })}`
    : undefined;
  return {
    async getCurrentUser() {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return sessionUserFromSupabase(data.user);
    },

    async requestMagicLink(email, next) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: emailRedirectTo(next) },
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

    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return { ok: false, message: passwordErrorMessage(error) };
      if (!data.session) return { ok: false, message: "Sign-in didn't complete. Please try again." };
      return { ok: true, needsConfirmation: false };
    },

    async signUp(email, password, next) {
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: emailRedirectTo(next) },
      });
      if (error) return { ok: false, message: passwordErrorMessage(error) };
      return { ok: true, needsConfirmation: !data.session };
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error("We couldn't sign you out. Please try again.");
    },

    subscribe(listener) {
      let active = true;
      let revision = 0;
      const { data } = client.auth.onAuthStateChange(
        (event) => {
          const currentRevision = ++revision;
          if (event === "SIGNED_OUT") {
            listener(null);
            return;
          }

          // Supabase advises keeping this callback synchronous. Verify the
          // user outside it instead of trusting the locally decoded session.
          setTimeout(() => {
            if (!active || currentRevision !== revision) return;
            void client.auth.getUser().then(({ data: verified, error }) => {
              if (!active || currentRevision !== revision) return;
              listener(error || !verified.user ? null : sessionUserFromSupabase(verified.user));
            }).catch(() => {
              if (active && currentRevision === revision) listener(null);
            });
          }, 0);
        },
      );
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    },
  };
}
