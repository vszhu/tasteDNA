"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Dish, ExtractedMenu, Rating, TasteProfile } from "@/types";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { buildTasteProfile } from "@/lib/taste/profile";
import { SAMPLE_MENU_MODEL } from "@/lib/menu/sample";
import { processExtractedMenu } from "@/lib/menu/process";

const STORAGE_KEY = "tastedna-v1";
const DEMO_USER_ID = "demo-user";

interface PersistedState {
  ratings: Rating[];
  customDishes: Dish[];
  extractedMenu: ExtractedMenu | null;
}

interface TasteContextValue extends PersistedState {
  dishes: Dish[];
  profile: TasteProfile;
  hydrated: boolean;
  rateDish: (dishId: string, value: Rating["value"], source?: Rating["source"]) => void;
  giveFeedback: (dish: Dish, liked: boolean) => void;
  setExtractedMenu: (menu: ExtractedMenu) => void;
  loadDemo: () => void;
  reset: () => void;
}

const initialState: PersistedState = { ratings: [], customDishes: [], extractedMenu: null };
const TasteContext = createContext<TasteContextValue | null>(null);

function demoRating(dishName: string, value: Rating["value"]): Rating {
  const dish = SEED_DISHES.find((item) => item.name === dishName);
  if (!dish) throw new Error(`Missing demo dish: ${dishName}`);
  return { id: `demo-${dish.id}`, userId: DEMO_USER_ID, dishId: dish.id, value, source: "onboarding", createdAt: new Date().toISOString() };
}

export function TasteProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Hydration is the external-storage subscription point for the demo adapter.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setState(JSON.parse(stored) as PersistedState);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const dishes = useMemo(() => [...SEED_DISHES, ...state.customDishes], [state.customDishes]);
  const profile = useMemo(() => buildTasteProfile(DEMO_USER_ID, state.ratings, dishes), [state.ratings, dishes]);

  const rateDish = useCallback((dishId: string, value: Rating["value"], source: Rating["source"] = "onboarding") => {
    setState((current) => ({
      ...current,
      ratings: [
        ...current.ratings.filter((rating) => rating.dishId !== dishId),
        { id: `rating-${dishId}`, userId: DEMO_USER_ID, dishId, value, source, createdAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const giveFeedback = useCallback((dish: Dish, liked: boolean) => {
    setState((current) => ({
      ...current,
      customDishes: [...current.customDishes.filter((item) => item.id !== dish.id), dish],
      ratings: [
        ...current.ratings.filter((rating) => rating.dishId !== dish.id),
        { id: `feedback-${dish.id}`, userId: DEMO_USER_ID, dishId: dish.id, value: liked ? 5 : 1, source: "feedback", createdAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const setExtractedMenu = useCallback((menu: ExtractedMenu) => setState((current) => ({ ...current, extractedMenu: menu })), []);
  const loadDemo = useCallback(() => {
    const ratings = [
      demoRating("Tonkotsu Ramen", 5), demoRating("Tacos al Pastor", 5), demoRating("Green Thai Curry", 4),
      demoRating("Smash Burger", 3), demoRating("Caesar Salad", 4), demoRating("Salmon Poke", 5),
      demoRating("Baked Mac and Cheese", 2), demoRating("Pad Thai", 4), demoRating("Grilled Ribeye", 4),
      demoRating("Vanilla Bean Ice Cream", 1), demoRating("Peruvian Ceviche", 3), demoRating("Korean Fried Chicken", 5),
    ];
    setState({ ratings, customDishes: [], extractedMenu: processExtractedMenu(SAMPLE_MENU_MODEL, "demo", true, "Loaded the hackathon sample menu.") });
  }, []);
  const reset = useCallback(() => setState(initialState), []);

  return <TasteContext.Provider value={{ ...state, dishes, profile, hydrated, rateDish, giveFeedback, setExtractedMenu, loadDemo, reset }}>{children}</TasteContext.Provider>;
}

export function useTaste() {
  const context = useContext(TasteContext);
  if (!context) throw new Error("useTaste must be used within TasteProvider");
  return context;
}
