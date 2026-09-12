// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ExtractedMenu, Rating } from "@/types";
import DecodePage from "@/app/decode/page";
import ResultsPage from "@/app/results/page";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { ANONYMOUS_TASTE_STORAGE_KEY } from "@/lib/taste/anonymous-storage";
import { medicationStorageKey } from "@/lib/medications/storage";
import { createMedicationDemoMenu } from "@/lib/medications/demo";
import { rankMedicationAwareMenu } from "@/lib/medications/check";
import { TasteProvider, useTaste } from "./taste-provider";
import { MedicationProvider, useMedications } from "./medication-provider";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseBrowserClient: () => null }));
vi.mock("@/components/providers/session-provider", () => ({ useSession: () => ({ status: "signed-out", user: null }) }));

const savedRating: Rating = { id: "existing-rating", userId: "demo-user", dishId: SEED_DISHES[0].id, value: 4, source: "onboarding", createdAt: "2026-09-12" };

function Probe() {
  const taste = useTaste();
  const meds = useMedications();
  const ready = taste.hydrated && meds.hydrated;
  const ranked = taste.extractedMenu ? rankMedicationAwareMenu(taste.extractedMenu, taste.profile, meds.medications) : [];
  return createElement("div", null,
    createElement("output", { "data-testid": "integrated-state" }, JSON.stringify({ ready, medications: meds.medications, ratings: taste.ratings, menu: taste.extractedMenu, ranked: ranked.map((item) => ({ name: item.dish.name, status: item.medicationCheck.status, score: item.score })) })),
    createElement("button", { disabled: !ready, onClick: meds.clearMedications }, "Clear test medications"),
    createElement("button", { disabled: !ready, onClick: () => {
      const spritz = taste.extractedMenu?.items.find((item) => item.dish.name === "Pink Grapefruit Spritz");
      if (spritz) taste.giveFeedback(spritz.dish, true);
    } }, "Like test spritz"),
  );
}

function tree(page: ReactNode) {
  return createElement(TasteProvider, null, createElement(MedicationProvider, null, createElement(Probe), page));
}
function state(): { ready: boolean; medications: string[]; ratings: Rating[]; menu: ExtractedMenu | null; ranked: { name: string; status: string; score: number }[] } {
  return JSON.parse(screen.getByTestId("integrated-state").textContent!);
}
function seed(menu: ExtractedMenu | null = null) {
  localStorage.setItem(ANONYMOUS_TASTE_STORAGE_KEY, JSON.stringify({ ratings: [savedRating], customDishes: [], extractedMenu: menu }));
  sessionStorage.setItem(medicationStorageKey("anonymous"), '["simvastatin"]');
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); seed(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("medications integrated with the real taste provider and menu pages", () => {
  it("loads sample dishes from the decoder without replacing saved taste ratings or medications", async () => {
    render(tree(createElement(DecodePage)));
    await waitFor(() => expect(state().ready).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Use sample menu" }));
    expect(state().ratings).toEqual([savedRating]);
    expect(state().medications).toEqual(["simvastatin"]);
    expect(state().menu?.menu.sourceType).toBe("demo");
    expect(state().menu?.items.some((item) => item.dish.name === "Pink Grapefruit Spritz")).toBe(true);
    expect(navigation.push).toHaveBeenCalledWith("/results");
    await waitFor(() => expect(JSON.parse(localStorage.getItem(ANONYMOUS_TASTE_STORAGE_KEY)!).ratings).toEqual([savedRating]));
    expect(localStorage.getItem(ANONYMOUS_TASTE_STORAGE_KEY)).not.toContain("simvastatin");
  });

  it("loads the same example menu from empty results while retaining the existing profile", async () => {
    render(tree(createElement(ResultsPage)));
    await waitFor(() => expect(state().ready).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Load sample" }));
    expect(state().ratings).toEqual([savedRating]);
    expect(state().medications).toEqual(["simvastatin"]);
    expect(screen.getByRole("button", { name: "Connection map" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "Your food and medication explorer" })).toBeTruthy();
  });

  it("sends only menu text to extraction and applies medications locally after the response", async () => {
    const menu = createMedicationDemoMenu();
    menu.menu.sourceType = "text";
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => menu });
    vi.stubGlobal("fetch", request);
    render(tree(createElement(DecodePage)));
    await waitFor(() => expect(state().ready).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Paste text" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Paste menu text" }), { target: { value: "Spritz — grapefruit juice 7" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode this menu" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/results"));
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("/api/menu/extract");
    expect([...options.body.entries()]).toEqual([["text", "Spritz — grapefruit juice 7"]]);
    expect(state().ratings).toEqual([savedRating]);
    expect(state().ranked.find((item) => item.name === "Pink Grapefruit Spritz")?.status).toBe("avoid");
  });

  it("recalculates taste feedback without clearing warnings, then restores taste-only results when medications are removed", async () => {
    seed(createMedicationDemoMenu());
    render(tree(createElement(ResultsPage)));
    await waitFor(() => expect(state().ready).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Like test spritz" }));
    const score = state().ranked.find((item) => item.name === "Pink Grapefruit Spritz")!.score;
    expect(state().ratings).toHaveLength(2);
    expect(state().ranked.at(-1)?.name).toBe("Pink Grapefruit Spritz");
    expect(state().ranked.at(-1)?.status).toBe("avoid");
    expect(within(screen.getByRole("complementary", { name: "Connection details" })).getByText("Label warning")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear test medications" }));
    expect(state().medications).toEqual([]);
    expect(state().ranked.every((item) => item.status === "not-checked")).toBe(true);
    expect(state().ranked.find((item) => item.name === "Pink Grapefruit Spritz")?.score).toBe(score);
    expect(state().ratings).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Your food and medication explorer" })).toBeNull();
    expect(sessionStorage.getItem(medicationStorageKey("anonymous"))).toBeNull();
  });
});
