"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { mockAuthAdapter } from "@/lib/auth/mock-adapter";
import type { SessionStatus, SessionUser } from "@/lib/auth/types";

/**
 * Session state for the group-dining features (sign-in, friends). Kept
 * entirely separate from `taste-provider.tsx` — the solo TasteDNA flow
 * neither needs nor depends on a signed-in user, and this provider can be
 * deleted or rewired to a real Supabase client without touching that one.
 */

interface SessionContextValue {
  user: SessionUser | null;
  status: SessionStatus;
  requestMagicLink: (email: string) => Promise<{ ok: true }>;
  signInForDemo: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const session = mockAuthAdapter.getSession();
    // Hydration is the external-storage subscription point for the mock adapter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(session);
    setStatus(session ? "signed-in" : "signed-out");
  }, []);

  const requestMagicLink = useCallback((email: string) => mockAuthAdapter.requestMagicLink(email), []);

  const signInForDemo = useCallback(async () => {
    const session = await mockAuthAdapter.signInForDemo();
    setUser(session);
    setStatus("signed-in");
  }, []);

  const signOut = useCallback(async () => {
    await mockAuthAdapter.signOut();
    setUser(null);
    setStatus("signed-out");
  }, []);

  return <SessionContext.Provider value={{ user, status, requestMagicLink, signInForDemo, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
