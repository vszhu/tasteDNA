import { describe, expect, it, vi } from "vitest";
import {
  ANONYMOUS_TASTE_STORAGE_KEY,
  loadAnonymousTasteState,
  persistenceScope,
  saveAnonymousTasteState,
  type TasteStorage,
} from "./anonymous-storage";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage: TasteStorage = {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, next) => { value = next; }),
    removeItem: vi.fn(() => { value = null; }),
  };
  return storage;
}

describe("anonymous TasteDNA persistence", () => {
  it("preserves the existing solo localStorage key and data", () => {
    const storage = memoryStorage();
    const state = { ratings: [], customDishes: [], extractedMenu: null };
    saveAnonymousTasteState(storage, state);

    expect(storage.setItem).toHaveBeenCalledWith(
      ANONYMOUS_TASTE_STORAGE_KEY,
      JSON.stringify(state),
    );
    expect(loadAnonymousTasteState(storage)).toEqual(state);
  });

  it("clears malformed local data safely", () => {
    const storage = memoryStorage("not-json");
    expect(loadAnonymousTasteState(storage).ratings).toEqual([]);
    expect(storage.removeItem).toHaveBeenCalledWith(ANONYMOUS_TASTE_STORAGE_KEY);
  });

  it("uses distinct anonymous and account scopes so login never imports implicitly", () => {
    expect(persistenceScope(null)).toBe("anonymous");
    expect(persistenceScope("user-1")).toBe("account:user-1");
  });
});
