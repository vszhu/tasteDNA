import { describe, expect, it } from "vitest";
import type { Rating } from "@/types";
import { processExtractedMenu } from "@/lib/menu/process";
import { SAMPLE_MENU_MODEL } from "@/lib/menu/sample";
import { buildTasteProfile } from "@/lib/taste/profile";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { rankMenuItems } from "./scoring";

describe("ratings → profile → menu → ranked recommendations", () => {
  it("completes the deterministic recommendation vertical slice", () => {
    const favorites = ["Tonkotsu Ramen", "Green Thai Curry", "Korean Fried Chicken"];
    const ratings: Rating[] = SEED_DISHES.filter((dish) => favorites.includes(dish.name)).map((dish) => ({ id: `r-${dish.id}`, userId: "demo", dishId: dish.id, value: 5, source: "onboarding", createdAt: "2026-01-01" }));
    const profile = buildTasteProfile("demo", ratings, SEED_DISHES);
    const menu = processExtractedMenu(SAMPLE_MENU_MODEL, "demo", true);
    const recommendations = rankMenuItems(menu.items, profile);

    expect(profile.ratingCount).toBe(3);
    expect(recommendations).toHaveLength(SAMPLE_MENU_MODEL.dishes.length);
    expect(recommendations[0].score).toBeGreaterThan(recommendations.at(-1)?.score ?? 100);
    expect(recommendations.every((item) => item.score >= 0 && item.score <= 100)).toBe(true);
    expect(recommendations[0].explanation.length).toBeGreaterThan(20);
  });
});
