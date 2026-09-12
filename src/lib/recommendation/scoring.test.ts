import { describe, expect, it } from "vitest";
import type { Dish, MenuItem, Rating } from "@/types";
import { buildTasteProfile } from "@/lib/taste/profile";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { rankMenuItems, scoreCandidate } from "./scoring";

function rating(dishId: string, value: Rating["value"]): Rating { return { id: dishId, userId: "u", dishId, value, source: "onboarding", createdAt: "2026-01-01" }; }

describe("candidate scoring", () => {
  const ramen = SEED_DISHES.find((dish) => dish.name === "Tonkotsu Ramen") as Dish;
  const iceCream = SEED_DISHES.find((dish) => dish.name === "Vanilla Bean Ice Cream") as Dish;
  const profile = buildTasteProfile("u", [rating(ramen.id, 5), rating(iceCream.id, 1)], [ramen, iceCream]);

  it("produces a bounded deterministic score with matching factors", () => {
    const first = scoreCandidate(ramen, profile);
    const second = scoreCandidate(ramen, profile);
    expect(first).toEqual(second);
    expect(first.score).toBeGreaterThan(50);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(first.positiveFactors.length).toBeGreaterThan(0);
  });

  it("ranks better candidates first with stable menu-order tie breaking", () => {
    const items: MenuItem[] = [ramen, iceCream].map((dish, index) => ({ id: `i${index}`, menuId: "m", menuOrder: index, dish }));
    const ranked = rankMenuItems(items, profile);
    expect(ranked[0].dish.id).toBe(ramen.id);
    expect(ranked.map((item) => item.rank)).toEqual([1, 2]);
  });

  it("handles cold start with a neutral score", () => {
    const cold = buildTasteProfile("u", [], [ramen]);
    expect(scoreCandidate(ramen, cold).score).toBe(50);
  });
});
