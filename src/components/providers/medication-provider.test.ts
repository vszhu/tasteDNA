// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SessionStatus, SessionUser } from "@/lib/auth/types";
import { medicationStorageKey } from "@/lib/medications/storage";
import { MedicationProvider, useMedications } from "./medication-provider";

const session = vi.hoisted(() => ({ current: { status: "signed-out" as SessionStatus, user: null as SessionUser | null } }));
vi.mock("@/components/providers/session-provider", () => ({ useSession: () => session.current }));

vi.mock("@/lib/db/supabase", () => ({ getSupabaseBrowserClient: () => null }));

const renderedLists: Array<{ scope: string; medications: string[]; hydrated: boolean }> = [];

function Probe() {
  const { medications, hydrated, storageError, addMedication, removeMedication, clearMedications } = useMedications();
  renderedLists.push({ scope: session.current.user?.id ?? "anonymous", medications, hydrated });
  return createElement("div", null,
    createElement("div", { "data-testid": "list" }, hydrated ? medications.join(",") : "loading"),
    createElement("div", { "data-testid": "error" }, storageError),
    createElement("button", { onClick: () => addMedication("simvastatin"), disabled: !hydrated }, "Add"),
    createElement("button", { onClick: () => removeMedication("simvastatin") }, "Remove"),
    createElement("button", { onClick: clearMedications }, "Clear"),
  );
}

function tree() {
  return createElement(MedicationProvider, null, createElement(Probe));
}

beforeEach(() => {
  session.current = { status: "signed-out", user: null };
  sessionStorage.clear();
  localStorage.clear();
  renderedLists.length = 0;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("medication provider", () => {
  it("persists only to tab session storage and restores on remount", async () => {
    localStorage.setItem("tastedna-v1", '{"original":"taste data"}');
    const first = render(tree());
    await waitFor(() => expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(sessionStorage.getItem(medicationStorageKey("anonymous"))).toBe('["simvastatin"]');
    expect(localStorage.getItem("tastedna-v1")).toBe('{"original":"taste data"}');
    first.unmount();
    render(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("simvastatin"));
  });

  it("removes medication and clears the session key", async () => {
    sessionStorage.setItem(medicationStorageKey("anonymous"), '["simvastatin","linezolid"]');
    render(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("simvastatin,linezolid"));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByTestId("list").textContent).toBe("linezolid");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByTestId("list").textContent).toBe("");
    expect(sessionStorage.getItem(medicationStorageKey("anonymous"))).toBeNull();
  });

  it("never renders the prior account's medications during an account switch", async () => {
    sessionStorage.setItem(medicationStorageKey("anonymous"), '["simvastatin"]');
    sessionStorage.setItem(medicationStorageKey("user:a"), '["linezolid"]');
    sessionStorage.setItem(medicationStorageKey("user:b"), '["fexofenadine"]');
    const view = render(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("simvastatin"));
    session.current = { status: "signed-in", user: { id: "a", email: "a@example.test", displayName: "A" } };
    view.rerender(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("linezolid"));
    session.current = { status: "signed-in", user: { id: "b", email: "b@example.test", displayName: "B" } };
    view.rerender(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("fexofenadine"));
    expect(renderedLists.filter((entry) => entry.scope === "a").every((entry) => !entry.medications.includes("simvastatin"))).toBe(true);
    expect(renderedLists.filter((entry) => entry.scope === "b").every((entry) => !entry.medications.includes("linezolid"))).toBe(true);
    session.current = { status: "signed-out", user: null };
    view.rerender(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("simvastatin"));
  });

  it("does not load the anonymous list while a signed-in user is unresolved", async () => {
    sessionStorage.setItem(medicationStorageKey("anonymous"), '["simvastatin"]');
    session.current = { status: "signed-in", user: null };
    render(tree());
    expect(screen.getByTestId("list").textContent).toBe("loading");
    expect(renderedLists.every((entry) => entry.medications.length === 0)).toBe(true);
  });

  it("shows corrupted storage instead of silently treating it as a restored empty list", async () => {
    sessionStorage.setItem(medicationStorageKey("anonymous"), '{"invalid":true}');
    render(tree());
    await waitFor(() => expect(screen.getByTestId("error").textContent).toContain("could not be restored"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByTestId("list").textContent).toBe("simvastatin");
    expect(screen.getByTestId("error").textContent).toBe("");
  });

  it("continues checking in memory while visibly reporting a storage write failure", async () => {
    render(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("") );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByTestId("list").textContent).toBe("simvastatin");
    expect(screen.getByTestId("error").textContent).toContain("could not save");
  });
});
