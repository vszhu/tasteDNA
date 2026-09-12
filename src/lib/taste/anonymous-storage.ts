import type { Dish, ExtractedMenu, Rating } from "@/types";

export const ANONYMOUS_TASTE_STORAGE_KEY = "tastedna-v1";

export interface AnonymousTasteState {
  ratings: Rating[];
  customDishes: Dish[];
  extractedMenu: ExtractedMenu | null;
}

export const EMPTY_ANONYMOUS_TASTE_STATE: AnonymousTasteState = {
  ratings: [],
  customDishes: [],
  extractedMenu: null,
};

export interface TasteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadAnonymousTasteState(storage: TasteStorage): AnonymousTasteState {
  const raw = storage.getItem(ANONYMOUS_TASTE_STORAGE_KEY);
  if (!raw) return EMPTY_ANONYMOUS_TASTE_STATE;

  try {
    const value = JSON.parse(raw) as Partial<AnonymousTasteState>;
    if (!Array.isArray(value.ratings) || !Array.isArray(value.customDishes)) throw new Error();
    return {
      ratings: value.ratings,
      customDishes: value.customDishes,
      extractedMenu: value.extractedMenu ?? null,
    };
  } catch {
    storage.removeItem(ANONYMOUS_TASTE_STORAGE_KEY);
    return EMPTY_ANONYMOUS_TASTE_STATE;
  }
}

export function saveAnonymousTasteState(storage: TasteStorage, state: AnonymousTasteState) {
  storage.setItem(ANONYMOUS_TASTE_STORAGE_KEY, JSON.stringify(state));
}

export function persistenceScope(userId: string | null) {
  return userId ? `account:${userId}` : "anonymous";
}
