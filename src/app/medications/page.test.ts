// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ExtractedMenu } from "@/types";
import { buildTasteProfile } from "@/lib/taste/profile";
import { createMedicationDemoMenu } from "@/lib/medications/demo";
import MedicationsPage from "./page";

const state = vi.hoisted(() => ({
  menu: null as ExtractedMenu | null,
  medications: [] as string[],
  storageError: null as string | null,
  setExtractedMenu: vi.fn(), addMedication: vi.fn(), removeMedication: vi.fn(), clearMedications: vi.fn(),
}));
const profile = buildTasteProfile("test", [], []);
vi.mock("@/components/providers/taste-provider", () => ({ useTaste: () => ({ profile, extractedMenu: state.menu, setExtractedMenu: state.setExtractedMenu, hydrated: true }) }));
vi.mock("@/components/providers/medication-provider", () => ({ useMedications: () => ({ medications: state.medications, hydrated: true, storageError: state.storageError, addMedication: state.addMedication, removeMedication: state.removeMedication, clearMedications: state.clearMedications }) }));

beforeEach(() => { state.menu = null; state.medications = []; state.storageError = null; vi.clearAllMocks(); });
afterEach(cleanup);

describe("medication workspace integration", () => {
  it("lets users find a newly covered medication by brand and select its exact form", () => {
    render(createElement(MedicationsPage));
    expect(screen.getByText("Choose from 12 medicines to redraw connections.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Manage list/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search medication or brand" }), { target: { value: "Synthroid" } });
    const matches = within(screen.getByRole("group", { name: "Covered medication matches" }));
    expect(matches.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(matches.getByRole("button", { name: "Add Levothyroxine, Oral tablets" }));
    expect(state.addMedication).toHaveBeenCalledWith("levothyroxine-tablets");
    expect(screen.getByRole("searchbox", { name: "Search medication or brand" }).getAttribute("value")).toBe("");
  });

  it("lets visitors explore example medicines without changing their medication list or current menu", () => {
    render(createElement(MedicationsPage));
    fireEvent.click(screen.getByRole("button", { name: "Example Simvastatin, Oral tablets" }));
    fireEvent.click(screen.getByRole("button", { name: "Example Tacrolimus, Immediate-release oral capsules" }));
    expect(within(screen.getByRole("region", { name: "Your medication list" })).getByText("/ 0 added")).toBeTruthy();
    expect(state.addMedication).not.toHaveBeenCalled();
    expect(state.removeMedication).not.toHaveBeenCalled();
    expect(state.setExtractedMenu).not.toHaveBeenCalled();
  });

  it("uses the current decoded menu and actual medications when opening My menu", () => {
    state.menu = createMedicationDemoMenu();
    state.menu.menu.restaurantName = "My current menu";
    state.menu.items = state.menu.items.slice(0, 2);
    state.medications = ["linezolid"];
    render(createElement(MedicationsPage));
    expect(screen.getByRole("button", { name: "My menu" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("My current menu")).toBeTruthy();
    const map = within(screen.getByRole("region", { name: "Interactive connection diagram" }));
    expect(map.getByRole("button", { name: "Medicine: Linezolid" })).toBeTruthy();
    expect(map.queryByRole("button", { name: "Medicine: Simvastatin" })).toBeNull();
    expect(map.getAllByRole("button", { name: /^Dish:/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Example lab" }));
    fireEvent.click(screen.getByRole("button", { name: "My menu" }));
    expect(screen.getByText("My current menu")).toBeTruthy();
    expect(state.setExtractedMenu).not.toHaveBeenCalled();
  });

  it("adopts only the example menu, never its example medication selections", () => {
    state.medications = ["fexofenadine"];
    render(createElement(MedicationsPage));
    fireEvent.click(screen.getByRole("button", { name: "Use this menu with my list" }));
    expect(state.setExtractedMenu).toHaveBeenCalledOnce();
    expect(state.setExtractedMenu.mock.calls[0][0].menu.sourceType).toBe("demo");
    expect(state.medications).toEqual(["fexofenadine"]);
    expect(state.addMedication).not.toHaveBeenCalled();
    expect(state.clearMedications).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "My menu" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("withholds the personal map if the medication list could not be reliably restored", () => {
    state.menu = createMedicationDemoMenu();
    state.storageError = "Your medication list could not be restored.";
    render(createElement(MedicationsPage));
    expect(screen.getByRole("heading", { name: "Review your medication list first." })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Your food and medication explorer" })).toBeNull();
  });
});
