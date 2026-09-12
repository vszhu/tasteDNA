"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ensurePublicUser } from "@/lib/auth/bootstrap";
import { createSupabaseAuthAdapter, type AuthAdapter, type MagicLinkResult } from "@/lib/auth/supabase-adapter";
import type { SessionStatus, SessionUser } from "@/lib/auth/types";
import { getSupabaseBrowserClient } from "@/lib/db/supabase";

/**
 * Request-scoped Supabase auth state. The Taste provider consumes this state
 * only to choose account persistence versus the anonymous local store.
 */

interface SessionContextValue {
  user: SessionUser | null;
  status: SessionStatus;
  requestMagicLink: (email: string) => Promise<MagicLinkResult>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(
    () => getSupabaseBrowserClient() ? "loading" : "signed-out",
  );
  const [user, setUser] = useState<SessionUser | null>(null);
  const adapterRef = useRef<AuthAdapter | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    let active = true;
    const adapter = createSupabaseAuthAdapter(client);
    adapterRef.current = adapter;

    void adapter.getCurrentUser().then(async (currentUser) => {
      if (currentUser) await ensurePublicUser(client, currentUser);
      if (!active) return;
      setUser(currentUser);
      setStatus(currentUser ? "signed-in" : "signed-out");
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setStatus("signed-out");
    });

    const unsubscribe = adapter.subscribe((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setStatus(nextUser ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
      adapterRef.current = null;
      unsubscribe();
    };
  }, []);

  const requestMagicLink = useCallback(async (email: string): Promise<MagicLinkResult> => {
    const adapter = adapterRef.current;
    if (!adapter) return { ok: false, message: "Supabase sign-in is not configured." };
    return adapter.requestMagicLink(email);
  }, []);

  const signOut = useCallback(async () => {
    await adapterRef.current?.signOut();
    setUser(null);
    setStatus("signed-out");
  }, []);

  return <SessionContext.Provider value={{ user, status, requestMagicLink, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
