// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildTasteProfile } from "@/lib/taste/profile";
import { rankMedicationAwareMenu } from "@/lib/medications/check";
import { createMedicationDemoMenu } from "@/lib/medications/demo";
import { InteractionExplorer } from "./interaction-explorer";

const profile = buildTasteProfile("test", [], []);
const menu = createMedicationDemoMenu();
function explorer(medications = ["simvastatin", "fexofenadine", "linezolid"]) {
  return createElement(InteractionExplorer, { recommendations: rankMedicationAwareMenu(menu, profile, medications), medications, currency: "USD", tasteSignals: 0 });
}
function diagram() { return within(screen.getByRole("region", { name: "Interactive connection diagram" })); }
function inspector() { return within(screen.getByRole("complementary", { name: "Connection details" })); }
afterEach(cleanup);

describe("interaction explorer controls", () => {
  it("traces a medicine to its dishes and resets to the full menu", () => {
    render(explorer());
    fireEvent.click(diagram().getByRole("button", { name: "Medicine: Simvastatin" }));
    expect(diagram().getAllByRole("button", { name: /^Dish:/ })).toHaveLength(2);
    expect(inspector().getByRole("heading", { name: "Simvastatin" })).toBeTruthy();
    expect(diagram().queryByRole("button", { name: "Dish: Truffle Mac & Cheese" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(diagram().getAllByRole("button", { name: /^Dish:/ })).toHaveLength(6);
  });

  it("links a selected dish to its warning, evidence, and original source", () => {
    render(explorer());
    fireEvent.click(diagram().getByRole("button", { name: "Dish: Pink Grapefruit Spritz" }));
    expect(inspector().getByRole("heading", { name: "Pink Grapefruit Spritz" })).toBeTruthy();
    const summary = inspector().getByText("Simvastatin: Grapefruit juice warning");
    expect(summary.closest("details")?.textContent).toContain("Does this dish or drink contain grapefruit juice");
    expect(summary.closest("details")?.querySelector("a")?.href).toContain("dailymed.nlm.nih.gov");
  });

  it("selects an alternative beyond the first page and clears a warning filter", () => {
    render(explorer());
    fireEvent.click(screen.getByRole("button", { name: /^Label warnings / }));
    expect(diagram().getAllByRole("button", { name: /^Dish:/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Explore Crispy Maitake Tacos, / }));
    expect(inspector().getByRole("heading", { name: "Crispy Maitake Tacos" })).toBeTruthy();
    expect(diagram().getByRole("button", { name: "Dish: Crispy Maitake Tacos" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Previous map dishes" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: /^All dishes / }).getAttribute("aria-pressed")).toBe("true");
  });

  it("does not leave a warning dish selected when switching to a no-match filter", () => {
    render(explorer());
    fireEvent.click(diagram().getByRole("button", { name: "Dish: Pink Grapefruit Spritz" }));
    fireEvent.click(screen.getByRole("button", { name: /^No listed match / }));
    expect(inspector().queryByRole("heading", { name: "Pink Grapefruit Spritz" })).toBeNull();
    expect(diagram().queryByRole("button", { name: "Dish: Pink Grapefruit Spritz" })).toBeNull();
  });

  it("drops stale medicine focus when the real medication list changes", () => {
    const view = render(explorer());
    fireEvent.click(diagram().getByRole("button", { name: "Medicine: Simvastatin" }));
    view.rerender(explorer(["linezolid"]));
    expect(diagram().queryByRole("button", { name: "Medicine: Simvastatin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    expect(diagram().getAllByRole("button", { name: /^Dish:/ })).toHaveLength(6);
  });

  it("keeps unsupported medicines visible and withholds alternatives", () => {
    render(explorer(["unlisted"]));
    fireEvent.click(diagram().getByRole("button", { name: "Medicine: unlisted" }));
    expect(inspector().getByText(/outside the reference/)).toBeTruthy();
    expect(screen.getByText(/No dishes qualify for this shortlist/)).toBeTruthy();
    expect(diagram().queryByRole("button", { name: /^Food term:/ })).toBeNull();
  });
});
