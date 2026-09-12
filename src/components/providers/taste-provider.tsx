"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { getSupabaseBrowserClient } from "@/lib/db/supabase";
import type { Dish, ExtractedMenu, Rating, TasteProfile } from "@/types";
import { SEED_DISHES } from "@/lib/taste/seed-foods";
import { buildTasteProfile } from "@/lib/taste/profile";
import { SAMPLE_MENU_MODEL } from "@/lib/menu/sample";
import { processExtractedMenu } from "@/lib/menu/process";
import {
  EMPTY_ANONYMOUS_TASTE_STATE,
  loadAnonymousTasteState,
  persistenceScope,
  saveAnonymousTasteState,
  type AnonymousTasteState,
} from "@/lib/taste/anonymous-storage";
import { SupabaseTasteRepository } from "@/lib/taste/repository";

const DEMO_USER_ID = "demo-user";
const ACCOUNT_LOAD_ERROR = "TasteDNA couldn't load saved account data.";

type PersistedState = AnonymousTasteState;

interface TasteContextValue extends PersistedState {
  dishes: Dish[];
  profile: TasteProfile;
  hydrated: boolean;
  persistenceError: string | null;
  rateDish: (dishId: string, value: Rating["value"], source?: Rating["source"]) => void;
  giveFeedback: (dish: Dish, liked: boolean) => void;
  setExtractedMenu: (menu: ExtractedMenu) => void;
  loadDemo: () => void;
  reset: () => void;
}

const initialState: PersistedState = EMPTY_ANONYMOUS_TASTE_STATE;
const TasteContext = createContext<TasteContextValue | null>(null);

function demoRating(userId: string, dishName: string, value: Rating["value"]): Rating {
  const dish = SEED_DISHES.find((item) => item.name === dishName);
  if (!dish) throw new Error(`Missing demo dish: ${dishName}`);
  return { id: `demo-${dish.id}`, userId, dishId: dish.id, value, source: "onboarding", createdAt: new Date().toISOString() };
}

export function TasteProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useSession();
  const [state, setState] = useState<PersistedState>(initialState);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const blockedSaveScope = useRef<string | null>(null);
  const repository = useMemo(() => {
    const client = getSupabaseBrowserClient();
    return client ? new SupabaseTasteRepository(client) : null;
  }, []);
  const accountUserId = status === "signed-in" ? user?.id ?? null : null;
  const targetScope = status === "loading" ? null : persistenceScope(accountUserId);
  const hydrated = targetScope !== null && loadedScope === targetScope;
  const profileUserId = accountUserId ?? DEMO_USER_ID;

  useEffect(() => {
    if (!targetScope) return;
    let active = true;

    async function hydrate() {
      try {
        if (accountUserId && repository) {
          const saved = await repository.load(accountUserId);
          if (!active) return;
          blockedSaveScope.current = null;
          setState({ ratings: saved.ratings, customDishes: saved.customDishes, extractedMenu: null });
          setPersistenceError(null);
        } else {
          const saved = loadAnonymousTasteState(localStorage);
          if (!active) return;
          blockedSaveScope.current = null;
          setState(saved);
          setPersistenceError(null);
        }
      } catch {
        if (!active) return;
        blockedSaveScope.current = targetScope;
        setState(initialState);
        setPersistenceError(ACCOUNT_LOAD_ERROR);
      } finally {
        if (active) setLoadedScope(targetScope);
      }
    }

    void hydrate();
    return () => { active = false; };
  }, [accountUserId, repository, targetScope]);

  const dishes = useMemo(() => [...SEED_DISHES, ...state.customDishes], [state.customDishes]);
  const profile = useMemo(
    () => buildTasteProfile(profileUserId, state.ratings, dishes),
    [profileUserId, state.ratings, dishes],
  );

  useEffect(() => {
    if (!hydrated || !targetScope || blockedSaveScope.current === targetScope) return;

    if (accountUserId && repository) {
      void repository.save(accountUserId, {
        ratings: state.ratings,
        customDishes: state.customDishes,
        profile,
      }).then(
        () => setPersistenceError(null),
        () => setPersistenceError("TasteDNA couldn't save account changes."),
      );
      return;
    }

    saveAnonymousTasteState(localStorage, state);
  }, [accountUserId, hydrated, profile, repository, state, targetScope]);

  const rateDish = useCallback((dishId: string, value: Rating["value"], source: Rating["source"] = "onboarding") => {
    setState((current) => ({
      ...current,
      ratings: [
        ...current.ratings.filter((rating) => rating.dishId !== dishId),
        { id: `rating-${dishId}`, userId: profileUserId, dishId, value, source, createdAt: new Date().toISOString() },
      ],
    }));
  }, [profileUserId]);

  const giveFeedback = useCallback((dish: Dish, liked: boolean) => {
    setState((current) => ({
      ...current,
      customDishes: [...current.customDishes.filter((item) => item.id !== dish.id), dish],
      ratings: [
        ...current.ratings.filter((rating) => rating.dishId !== dish.id),
        { id: `feedback-${dish.id}`, userId: profileUserId, dishId: dish.id, value: liked ? 5 : 1, source: "feedback", createdAt: new Date().toISOString() },
      ],
    }));
  }, [profileUserId]);

  const setExtractedMenu = useCallback((menu: ExtractedMenu) => setState((current) => ({ ...current, extractedMenu: menu })), []);
  const loadDemo = useCallback(() => {
    const ratings = [
      demoRating(profileUserId, "Tonkotsu Ramen", 5), demoRating(profileUserId, "Tacos al Pastor", 5), demoRating(profileUserId, "Green Thai Curry", 4),
      demoRating(profileUserId, "Smash Burger", 3), demoRating(profileUserId, "Caesar Salad", 4), demoRating(profileUserId, "Salmon Poke", 5),
      demoRating(profileUserId, "Baked Mac and Cheese", 2), demoRating(profileUserId, "Pad Thai", 4), demoRating(profileUserId, "Grilled Ribeye", 4),
      demoRating(profileUserId, "Vanilla Bean Ice Cream", 1), demoRating(profileUserId, "Peruvian Ceviche", 3), demoRating(profileUserId, "Korean Fried Chicken", 5),
    ];
    setState({ ratings, customDishes: [], extractedMenu: processExtractedMenu(SAMPLE_MENU_MODEL, "demo", true, "Loaded the hackathon sample menu.") });
  }, [profileUserId]);
  const reset = useCallback(() => setState(initialState), []);

  return <TasteContext.Provider value={{ ...state, dishes, profile, hydrated, persistenceError, rateDish, giveFeedback, setExtractedMenu, loadDemo, reset }}>{children}</TasteContext.Provider>;
}

export function useTaste() {
  const context = useContext(TasteContext);
  if (!context) throw new Error("useTaste must be used within TasteProvider");
  return context;
}
