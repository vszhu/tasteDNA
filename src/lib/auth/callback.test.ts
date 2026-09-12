import { describe, expect, it } from "vitest";
import { parseEmailOtpType, safeNextPath, signInPath } from "./callback";

describe("auth callback input", () => {
  it("allows only local redirect paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("https://attacker.test")).toBe("/friends");
    expect(safeNextPath("//attacker.test")).toBe("/friends");
  });

  it.each(["/\\attacker.test", "/\n/attacker.test", "javascript:alert(1)", "https://attacker.test", "//attacker.test"])("rejects unsafe next path %j", (value) => {
    expect(safeNextPath(value)).toBe("/friends");
  });

  it("preserves the complete local destination across an auth error", () => {
    const next = "/sessions/new?venues=one,two,three";
    const url = new URL(signInPath(next, "invalid-link"), "https://taste.example.test");
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("next")).toBe(next);
    expect(url.searchParams.get("error")).toBe("invalid-link");
  });

  it("rejects invalid OTP types", () => {
    expect(parseEmailOtpType("magiclink")).toBe("magiclink");
    expect(parseEmailOtpType("not-real")).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});
