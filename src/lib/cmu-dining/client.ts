import { CMU_DINING_LAST_GOOD } from "./fixture";
import { CmuDiningLocationsSchema } from "./schema";
import type { CmuDiningFallbackReason, CmuDiningFeed } from "./types";

export const DEFAULT_CMU_DINING_URL = "https://api.cmueats.com/v2/locations";
export const DEFAULT_CMU_DINING_TIMEOUT_MS = 8_000;

interface CmuDiningClientOptions {
  fetcher?: typeof fetch;
  url?: string;
  timeoutMs?: number;
  now?: () => Date;
}

class CmuDiningFeedError extends Error {
  constructor(readonly reason: CmuDiningFallbackReason) {
    super(reason);
    this.name = "CmuDiningFeedError";
  }
}

function configuredTimeout() {
  const parsed = Number.parseInt(process.env.CMU_DINING_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CMU_DINING_TIMEOUT_MS;
}

function fallbackFeed(reason: CmuDiningFallbackReason): CmuDiningFeed {
  return {
    locations: CMU_DINING_LAST_GOOD.locations,
    source: "fixture",
    capturedAt: CMU_DINING_LAST_GOOD.capturedAt,
    fallbackReason: reason,
  };
}

export async function fetchCmuDiningFeed(
  options: CmuDiningClientOptions = {},
): Promise<CmuDiningFeed> {
  const fetcher = options.fetcher ?? fetch;
  const url = options.url ?? process.env.CMU_DINING_API_URL ?? DEFAULT_CMU_DINING_URL;
  const timeoutMs = options.timeoutMs ?? configuredTimeout();
  const now = options.now ?? (() => new Date());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new CmuDiningFeedError("http-error");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CmuDiningFeedError("invalid-data");
    }

    const parsed = CmuDiningLocationsSchema.safeParse(payload);
    if (!parsed.success) throw new CmuDiningFeedError("invalid-data");

    return {
      locations: parsed.data,
      source: "live",
      capturedAt: now().toISOString(),
    };
  } catch (error) {
    if (controller.signal.aborted) return fallbackFeed("timeout");
    if (error instanceof CmuDiningFeedError) return fallbackFeed(error.reason);
    return fallbackFeed("network-error");
  } finally {
    clearTimeout(timeout);
  }
}
