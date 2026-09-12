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
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function parseEmailOtpType(value: string | null): SupportedEmailOtpType | null {
  return value && EMAIL_OTP_TYPES.has(value as SupportedEmailOtpType)
    ? (value as SupportedEmailOtpType)
    : null;
}
