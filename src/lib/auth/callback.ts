export type SupportedEmailOtpType =
  | "email"
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change";

const EMAIL_OTP_TYPES = new Set<SupportedEmailOtpType>([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

export function safeNextPath(value: string | null, fallback = "/friends") {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\") ||
      [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return fallback;
  try {
    const url = new URL(value, "https://tastedna.invalid");
    return url.origin === "https://tastedna.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function signInPath(next: string, error?: string) {
  const params = new URLSearchParams({ next: safeNextPath(next) });
  if (error) params.set("error", error);
  return `/sign-in?${params}`;
}

export function parseEmailOtpType(value: string | null): SupportedEmailOtpType | null {
  return value && EMAIL_OTP_TYPES.has(value as SupportedEmailOtpType)
    ? (value as SupportedEmailOtpType)
    : null;
}
