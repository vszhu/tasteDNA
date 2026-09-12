export const MENU_PRIMARY_MODEL = process.env.OPENAI_MENU_MODEL?.trim() || "gpt-5.6-luna";
export const MENU_FALLBACK_MODEL = process.env.OPENAI_MENU_FALLBACK_MODEL?.trim() || "gpt-5.6-terra";
export const MENU_REASONING_EFFORT = "none" as const;

const configuredTimeout = Number(process.env.OPENAI_MENU_TIMEOUT_MS);
export const MENU_REQUEST_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout >= 5_000
  ? configuredTimeout
  : 30_000;
