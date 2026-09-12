import { describe, expect, it } from "vitest";
import { sessionInviteUrl } from "./invite-link";

const id = "c2000000-0000-4000-8000-000000000001";

describe("shared meal URLs", () => {
  it("uses the published origin instead of the sender's laptop address", () => {
    expect(sessionInviteUrl(id, "http://127.0.0.1:3010", "https://taste.example.test"))
      .toBe(`https://taste.example.test/sessions/${id}`);
  });

  it("keeps the current deployed origin when no public override is configured", () => {
    expect(sessionInviteUrl(id, "https://taste.example.test"))
      .toBe(`https://taste.example.test/sessions/${id}`);
  });

  it.each(["http://127.0.0.1:3010", "https://localhost", "https://127.1", "https://[::1]", "https://192.168.1.2", "https://172.16.0.2"])("does not copy a device-only link: %s", (origin) => {
    expect(() => sessionInviteUrl(id, origin)).toThrow();
  });

  it.each(["javascript:alert(1)", "https://user:pass@taste.example.test", "https://taste.example.test/path", "https://taste.example.test?token=test"])("rejects an invalid public origin: %s", (origin) => {
    expect(() => sessionInviteUrl(id, "https://taste.example.test", origin)).toThrow();
  });
});
