import type { DiningSession, DiningSessionMember, MealPreferenceState } from "@/types/group";
import { EMPTY_MEAL_PREFERENCE_STATE } from "./meal-preferences";

/**
 * Mock, localStorage-backed stand-in for the real sessions API (which
 * doesn't exist yet). Uses the real `DiningSession`/`DiningSessionMember`
 * shapes from `src/types/group.ts` so swapping in real endpoints later is a
 * fetch-call change, not a type change. Kept in its own storage key,
 * independent of `taste-provider.tsx` and the Task 2 auth/friends store.
 */

const STORAGE_KEY = "tastedna-mock-sessions-v1";
const SELF_USER_ID = "u-me";

export interface StoredSession {
  session: DiningSession;
  members: DiningSessionMember[];
}

function seedDemoSession(): StoredSession {
  const now = new Date().toISOString();
  return {
    session: {
      id: "session-demo",
      title: "Friday lunch",
      createdByUserId: SELF_USER_ID,
      candidateVenueIds: ["the-exchange", "taste-of-india", "wild-blue-sushi"],
      status: "open",
      createdAt: now,
      updatedAt: now,
    },
    members: [
      { sessionId: "session-demo", userId: SELF_USER_ID, displayName: "You", status: "invited", mealPreferenceState: EMPTY_MEAL_PREFERENCE_STATE },
      { sessionId: "session-demo", userId: "u-priya", displayName: "Priya", status: "responded", mealPreferenceState: { ...EMPTY_MEAL_PREFERENCE_STATE, desiredTags: ["spicy", "filling"] }, respondedAt: now },
      { sessionId: "session-demo", userId: "u-marcus", displayName: "Marcus", status: "joined", mealPreferenceState: EMPTY_MEAL_PREFERENCE_STATE },
    ],
  };
}

// In-memory cache so the adapter works the same way in tests/SSR (no
// `window`) as in the browser — localStorage is a write-through, not the
// only source of truth.
let memoryStore: Record<string, StoredSession> | null = null;

function loadStore(): Record<string, StoredSession> {
  if (memoryStore) return memoryStore;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        memoryStore = JSON.parse(stored) as Record<string, StoredSession>;
        return memoryStore;
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  const demo = seedDemoSession();
  memoryStore = { [demo.session.id]: demo };
  return memoryStore;
}

function saveStore(store: Record<string, StoredSession>) {
  memoryStore = store;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockSessionAdapter = {
  async listSessions(): Promise<DiningSession[]> {
    await delay(150);
    return Object.values(loadStore()).map((entry) => entry.session);
  },

  async getSession(id: string): Promise<StoredSession | null> {
    await delay(150);
    return loadStore()[id] ?? null;
  },

  async createSession(input: { title: string; candidateVenueIds: string[]; inviteeUserIds: Array<{ userId: string; displayName: string }> }): Promise<DiningSession> {
    await delay(300);
    const store = loadStore();
    const now = new Date().toISOString();
    const id = `session-${Date.now()}`;
    const session: DiningSession = {
      id,
      title: input.title,
      createdByUserId: SELF_USER_ID,
      candidateVenueIds: input.candidateVenueIds,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    const members: DiningSessionMember[] = [
      { sessionId: id, userId: SELF_USER_ID, displayName: "You", status: "joined", mealPreferenceState: EMPTY_MEAL_PREFERENCE_STATE },
      ...input.inviteeUserIds.map((invitee): DiningSessionMember => ({ sessionId: id, userId: invitee.userId, displayName: invitee.displayName, status: "invited", mealPreferenceState: EMPTY_MEAL_PREFERENCE_STATE })),
    ];
    saveStore({ ...store, [id]: { session, members } });
    return session;
  },

  /** Records one member's temporary meal check-in. Never touches ratings or TasteProfile storage. */
  async submitMealPreferences(sessionId: string, userId: string, mealPreferenceState: MealPreferenceState): Promise<DiningSessionMember[]> {
    await delay(250);
    const store = loadStore();
    const entry = store[sessionId];
    if (!entry) throw new Error("Session not found");
    const now = new Date().toISOString();
    const members = entry.members.map((member) => (member.userId === userId ? { ...member, mealPreferenceState, status: "responded" as const, respondedAt: now } : member));
    saveStore({ ...store, [sessionId]: { ...entry, members } });
    return members;
  },
};

export { SELF_USER_ID };
