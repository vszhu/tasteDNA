// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { VenueIngredientDetails } from "./venue-ingredient-details";

afterEach(cleanup);

it("distinguishes restaurant menu components, recipe estimates, and absent ingredients", () => {
  const dish = SEED_DISHES[0];
  render(createElement(VenueIngredientDetails, { items: [
    { id: "published", menuId: "menu", menuOrder: 0, dish: { ...dish, ingredients: ["tomato", "mozzarella"], ingredientSource: { kind: "published-menu", label: "CMU published menu components", url: "https://www.cmu.edu/menu.pdf", checkedAt: "2026-09-12" } } },
    { id: "estimated", menuId: "menu", menuOrder: 1, dish: { ...dish, ingredients: ["rice", "tofu"], ingredientSource: { kind: "estimated", label: "Recipe estimate" } } },
    { id: "unknown", menuId: "menu", menuOrder: 2, dish: { ...dish, ingredients: [] } },
  ] }));
  expect(screen.getByRole("link", { name: "Published menu components" }).getAttribute("href")).toBe("https://www.cmu.edu/menu.pdf");
  expect(screen.getByText("Recipe estimate — not confirmed by the restaurant.")).toBeTruthy();
  expect(screen.getByText("Ingredient details unavailable.")).toBeTruthy();
  expect(screen.getByText("rice, tofu")).toBeTruthy();
});
