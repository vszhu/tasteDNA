import { describe, expect, it } from "vitest";
import { isAuthorizedCmuSyncRequest } from "./admin";

describe("CMU Dining sync authorization", () => {
  it("accepts only the configured bearer secret", () => {
    const authorized = new Request("http://localhost/api/admin/cmu-dining/sync", {
      headers: { authorization: "Bearer sync-secret" },
    });
    const wrong = new Request("http://localhost/api/admin/cmu-dining/sync", {
      headers: { authorization: "Bearer wrong" },
    });

    expect(isAuthorizedCmuSyncRequest(authorized, "sync-secret")).toBe(true);
    expect(isAuthorizedCmuSyncRequest(wrong, "sync-secret")).toBe(false);
    expect(isAuthorizedCmuSyncRequest(new Request(authorized.url), "sync-secret")).toBe(false);
  });
});
