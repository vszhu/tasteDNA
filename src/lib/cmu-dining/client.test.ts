import { describe, expect, it, vi } from "vitest";
import { CMU_DINING_LAST_GOOD } from "./fixture";
import { fetchCmuDiningFeed } from "./client";

function jsonFetcher(value: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  })) as unknown as typeof fetch;
}

describe("CMU Dining client", () => {
  it("accepts and timestamps a valid mocked feed", async () => {
    const result = await fetchCmuDiningFeed({
      fetcher: jsonFetcher(CMU_DINING_LAST_GOOD.locations),
      now: () => new Date("2026-09-12T12:00:00.000Z"),
    });

    expect(result.source).toBe("live");
    expect(result.capturedAt).toBe("2026-09-12T12:00:00.000Z");
    expect(result.locations).toHaveLength(CMU_DINING_LAST_GOOD.locations.length);
  });

  it("uses the last-good fixture for malformed upstream data", async () => {
    const result = await fetchCmuDiningFeed({ fetcher: jsonFetcher([{ id: "incomplete" }]) });

    expect(result.source).toBe("fixture");
    expect(result.fallbackReason).toBe("invalid-data");
    expect(result.locations).toEqual(CMU_DINING_LAST_GOOD.locations);
  });

  it("uses the fixture for upstream HTTP errors", async () => {
    const result = await fetchCmuDiningFeed({ fetcher: jsonFetcher({ error: true }, 503) });
    expect(result).toEqual(expect.objectContaining({ source: "fixture", fallbackReason: "http-error" }));
  });

  it("aborts a slow request and uses the fixture", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as unknown as typeof fetch;

    const result = await fetchCmuDiningFeed({ fetcher, timeoutMs: 5 });
    expect(result).toEqual(expect.objectContaining({ source: "fixture", fallbackReason: "timeout" }));
  });
});
