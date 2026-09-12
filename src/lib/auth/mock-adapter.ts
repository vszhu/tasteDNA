import { canSendFriendRequest, normalizeEmail, respondToRequest } from "./friend-rules";
import type { Friend, SendFriendRequestResult, SessionUser } from "./types";

/**
 * Mock, localStorage-backed stand-in for real Supabase magic-link auth and a
 * `friendships` API. Deliberately isolated from `taste-provider.tsx`'s
 * storage (a different key, a different owner) so this can be deleted
 * wholesale once Developer 3 ships the real thing, without touching solo
 * TasteDNA state at all.
 */

const STORAGE_KEY = "tastedna-mock-social-v1";
const MAGIC_LINK_DELAY_MS = 500;

const DEMO_SELF: SessionUser = { id: "u-me", email: "me@andrew.cmu.edu", displayName: "You" };

const DEMO_FRIENDS: Friend[] = [
  { friendshipId: "f-priya", user: { id: "u-priya", email: "priya@andrew.cmu.edu", displayName: "Priya" }, status: "accepted" },
  { friendshipId: "f-marcus", user: { id: "u-marcus", email: "marcus@andrew.cmu.edu", displayName: "Marcus" }, status: "accepted" },
  { friendshipId: "f-jae", user: { id: "u-jae", email: "jae@andrew.cmu.edu", displayName: "Jae" }, status: "pending-incoming" },
  { friendshipId: "f-lin", user: { id: "u-lin", email: "lin@andrew.cmu.edu", displayName: "Lin" }, status: "pending-outgoing" },
];

interface MockState {
  signedIn: boolean;
  friends: Friend[];
}

function loadState(): MockState {
  if (typeof window === "undefined") return { signedIn: true, friends: DEMO_FRIENDS };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as MockState;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return { signedIn: true, friends: DEMO_FRIENDS };
}

function saveState(state: MockState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAuthAdapter = {
  getSession(): SessionUser | null {
    return loadState().signedIn ? DEMO_SELF : null;
  },
  /** Always resolves the same way regardless of whether the email is real — never an enumeration oracle. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature mirrors the real adapter, which would email this address
  async requestMagicLink(email: string): Promise<{ ok: true }> {
    await delay(MAGIC_LINK_DELAY_MS);
    return { ok: true };
  },
  async signOut(): Promise<void> {
    const state = loadState();
    saveState({ ...state, signedIn: false });
  },
  /** Demo-only affordance: a real magic link is clicked from email, which this environment can't send. */
  async signInForDemo(): Promise<SessionUser> {
    const state = loadState();
    saveState({ ...state, signedIn: true });
    return DEMO_SELF;
  },
};

export const mockFriendsAdapter = {
  async listFriends(): Promise<Friend[]> {
    await delay(150);
    return loadState().friends;
  },
  async sendFriendRequest(email: string): Promise<SendFriendRequestResult> {
    await delay(300);
    const state = loadState();
    const result = canSendFriendRequest(state.friends, email, DEMO_SELF.email);
    if (!result.ok) return result;
    const normalized = normalizeEmail(email);
    const newFriend: Friend = {
      friendshipId: `f-${normalized}`,
      user: { id: `u-${normalized}`, email: normalized, displayName: normalized.split("@")[0] },
      status: "pending-outgoing",
    };
    saveState({ ...state, friends: [...state.friends, newFriend] });
    return { ok: true };
  },
  async respondToRequest(friendshipId: string, action: "accept" | "reject"): Promise<Friend[]> {
    await delay(200);
    const state = loadState();
    const updated = respondToRequest(state.friends, friendshipId, action);
    saveState({ ...state, friends: updated });
    return updated;
  },
};
