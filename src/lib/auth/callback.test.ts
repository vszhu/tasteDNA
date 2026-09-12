import { describe, expect, it } from "vitest";
import { parseEmailOtpType, safeNextPath } from "./callback";

describe("auth callback input", () => {
  it("allows only local redirect paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("https://attacker.test")).toBe("/friends");
    expect(safeNextPath("//attacker.test")).toBe("/friends");
  });

  it("rejects invalid OTP types", () => {
    expect(parseEmailOtpType("magiclink")).toBe("magiclink");
    expect(parseEmailOtpType("not-real")).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});
