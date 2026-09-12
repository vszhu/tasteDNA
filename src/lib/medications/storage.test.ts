import { describe, expect, it } from "vitest";
import { medicationStorageKey, normalizeMedicationSelections, parseMedicationSelections } from "./storage";

describe("medication session storage", () => {
  it("isolates anonymous and account lists", () => {
    expect(new Set(["anonymous", "user:a", "user:b"].map(medicationStorageKey)).size).toBe(3);
    expect(medicationStorageKey("anonymous")).not.toBe("tastedna-v1");
  });
  it("deduplicates aliases while retaining unsupported medications", () => {
    expect(normalizeMedicationSelections(["Zocor", "simvastatin", "Unlisted", " unlisted "])).toEqual(["simvastatin", "unlisted"]);
    expect(parseMedicationSelections('["Allegra","unknown medication"]')).toEqual(["fexofenadine", "unknown medication"]);
  });
  it("accepts empty and valid lists", () => {
    expect(parseMedicationSelections(null)).toEqual([]);
    expect(parseMedicationSelections("[]")).toEqual([]);
    expect(parseMedicationSelections('["linezolid"]')).toEqual(["linezolid"]);
  });
  it.each(["broken", "null", "{}", '["simvastatin",123]', '[""]', '["  "]', JSON.stringify(["x".repeat(101)]), JSON.stringify(Array(13).fill("simvastatin"))])("rejects malformed state without silently dropping entries: %s", (raw) => {
    expect(() => parseMedicationSelections(raw)).toThrow();
  });
});
