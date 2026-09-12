// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MedicationAccount } from "@/lib/medications/account";
import { medicationStorageKey } from "@/lib/medications/storage";
import { AccountMedicationSettings } from "@/components/medications/account-medication-settings";
import { GroupMedicationCard } from "@/components/medications/group-medication-card";
import { MedicationProvider, useMedications } from "./medication-provider";

const state = vi.hoisted(() => ({ userId: "a", load: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock("./session-provider", () => ({ useSession: () => ({ status: state.userId ? "signed-in" : "signed-out", user: state.userId ? { id: state.userId } : null }) }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseBrowserClient: () => ({}) }));
vi.mock("@/lib/medications/account", () => ({ createMedicationAccountRepository: () => state }));

function saved(userId = "a", medications = ["simvastatin"], useInGroups = false, revision = "revision-1"): MedicationAccount {
  return { user_id: userId, medications, use_in_groups: useInGroups, revision, updated_at: "2026-09-12T12:00:00Z" };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function Probe() {
  const { medications, hydrated, addMedication } = useMedications();
  return createElement("div", null,
    createElement("p", { "data-testid": "list" }, hydrated ? medications.join(",") : "loading"),
    createElement("button", { onClick: () => addMedication("linezolid"), disabled: !hydrated }, "Add test medicine"),
    createElement(AccountMedicationSettings), createElement(GroupMedicationCard));
}
function tree() { return createElement(MedicationProvider, null, createElement(Probe)); }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); state.userId = "a"; state.load.mockResolvedValue(saved()); state.save.mockImplementation(async (id, meds, groups) => saved(id, meds, groups, "revision-2")); state.remove.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("account medication save and group consent", () => {
  it("loads the owner's saved list but does not silently enable groups or upload it", async () => {
    render(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("simvastatin"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(state.save).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Medication checks for your circle" }).textContent).not.toContain("simvastatin");
  });

  it("applies edits and explicit consent only on Save, with owner identity", async () => {
    render(tree());
    await screen.findByText("simvastatin");
    fireEvent.click(screen.getByRole("button", { name: "Add test medicine" }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(state.save).not.toHaveBeenCalled();
    expect(screen.getByText(/Your group medication checks are off/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save to my account" }));
    await screen.findByText("Saved · your list is connected to group meals.");
    expect(state.save).toHaveBeenCalledWith("a", ["simvastatin", "linezolid"], true);
  });

  it("does not adopt or upload an anonymous list after signing in", async () => {
    sessionStorage.setItem(medicationStorageKey("anonymous"), '["linezolid"]');
    state.load.mockResolvedValue(null);
    render(tree());
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe(""));
    expect(state.save).not.toHaveBeenCalled();
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("restores an unsaved tab draft only while its account revision is unchanged", async () => {
    const first = render(tree()); await screen.findByText("simvastatin");
    fireEvent.click(screen.getByRole("button", { name: "Add test medicine" })); fireEvent.click(screen.getByRole("checkbox"));
    first.unmount(); const second = render(tree());
    await screen.findByText("simvastatin,linezolid");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    second.unmount(); state.load.mockResolvedValue(saved("a", ["fexofenadine"], false, "changed-on-another-device")); render(tree());
    await screen.findByText("fexofenadine");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("masks a late account load after switching accounts", async () => {
    const old = deferred<MedicationAccount>(); state.load.mockReturnValueOnce(old.promise).mockResolvedValueOnce(saved("b", ["fexofenadine"]));
    const view = render(tree()); await waitFor(() => expect(state.load).toHaveBeenCalledWith("a"));
    state.userId = "b"; view.rerender(tree());
    expect(screen.getByTestId("list").textContent).toBe("loading");
    await screen.findByText("fexofenadine");
    await act(async () => old.resolve(saved("a")));
    expect(screen.getByTestId("list").textContent).toBe("fexofenadine");
  });

  it("does not restore a previous user's completed save after an account switch", async () => {
    const old = deferred<MedicationAccount>(); state.save.mockReturnValue(old.promise);
    const view = render(tree()); await screen.findByText("simvastatin"); fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save to my account" }));
    state.userId = "b"; state.load.mockResolvedValue(saved("b", ["fexofenadine"])); view.rerender(tree());
    await screen.findByText("fexofenadine"); await act(async () => old.resolve(saved("a", ["simvastatin"], true)));
    expect(screen.getByTestId("list").textContent).toBe("fexofenadine");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("reports failed writes and keeps the last saved group setting", async () => {
    state.save.mockRejectedValue(new Error("network")); render(tree()); await screen.findByText("simvastatin");
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Save to my account" }));
    expect((await screen.findByRole("alert")).textContent).toContain("last saved settings");
    expect(screen.queryByText("Saved · your list is connected to group meals.")).toBeNull();
  });

  it("deletes the owner's saved copy, switches group checks off, and retains the personal tab draft", async () => {
    state.load.mockResolvedValue(saved("a", ["simvastatin"], true)); render(tree()); await screen.findByText("simvastatin");
    fireEvent.click(screen.getByRole("button", { name: "Delete saved copy" }));
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith("a"));
    await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false));
    expect(screen.getByTestId("list").textContent).toBe("simvastatin");
  });
});
