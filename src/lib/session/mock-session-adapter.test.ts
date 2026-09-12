import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mockSessionAdapter } from "./mock-session-adapter";

describe("mock-session-adapter source", () => {
  it("never imports the persistent taste engine or taste provider", () => {
    const source = readFileSync(fileURLToPath(new URL("./mock-session-adapter.ts", import.meta.url)), "utf-8");
    const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
    for (const line of importLines) expect(line).not.toMatch(/taste-provider|@\/lib\/taste/);
  });
});

describe("mockSessionAdapter", () => {
  it("creates a session with the creator auto-joined and invitees invited", async () => {
    const session = await mockSessionAdapter.createSession({
      title: "Test lunch",
      candidateVenueIds: ["v1", "v2", "v3"],
      inviteeUserIds: [{ userId: "u-a", displayName: "A" }, { userId: "u-b", displayName: "B" }],
    });
    expect(session.title).toBe("Test lunch");
    expect(session.candidateVenueIds).toEqual(["v1", "v2", "v3"]);
    expect(session.status).toBe("open");

    const stored = await mockSessionAdapter.getSession(session.id);
    expect(stored?.members.map((member) => ({ userId: member.userId, status: member.status }))).toEqual([
      { userId: "u-me", status: "joined" },
      { userId: "u-a", status: "invited" },
      { userId: "u-b", status: "invited" },
    ]);
  });

  it("submitMealPreferences updates only the target member, leaving others untouched", async () => {
    const session = await mockSessionAdapter.createSession({
      title: "Another lunch",
      candidateVenueIds: ["v1", "v2", "v3"],
      inviteeUserIds: [{ userId: "u-a", displayName: "A" }],
    });
    const preferenceState = { desiredTags: ["spicy" as const], avoidedTags: [], excludedIngredients: ["peanuts"], excludedProteinTypes: [] };
    const members = await mockSessionAdapter.submitMealPreferences(session.id, "u-a", preferenceState);

    const updated = members.find((member) => member.userId === "u-a");
    expect(updated?.status).toBe("responded");
    expect(updated?.mealPreferenceState).toEqual(preferenceState);
    expect(updated?.respondedAt).toBeDefined();

    const untouched = members.find((member) => member.userId === "u-me");
    expect(untouched?.status).toBe("joined");
    expect(untouched?.mealPreferenceState.desiredTags).toEqual([]);
  });

  it("throws for an unknown session id", async () => {
    await expect(mockSessionAdapter.submitMealPreferences("missing", "u-me", { desiredTags: [], avoidedTags: [], excludedIngredients: [], excludedProteinTypes: [] })).rejects.toThrow();
  });
});
