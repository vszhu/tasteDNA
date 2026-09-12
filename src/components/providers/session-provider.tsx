"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ensurePublicUser } from "@/lib/auth/bootstrap";
import { createSupabaseAuthAdapter, type AuthAdapter, type MagicLinkResult, type PasswordAuthResult } from "@/lib/auth/supabase-adapter";
import type { SessionStatus, SessionUser } from "@/lib/auth/types";
import { getSupabaseBrowserClient } from "@/lib/db/supabase";

/**
 * Request-scoped Supabase auth state. The Taste provider consumes this state
 * only to choose account persistence versus the anonymous local store.
 */

interface SessionContextValue {
  user: SessionUser | null;
  status: SessionStatus;
  requestMagicLink: (email: string, next?: string) => Promise<MagicLinkResult>;
  signInWithPassword: (email: string, password: string) => Promise<PasswordAuthResult>;
  signUp: (email: string, password: string, next?: string) => Promise<PasswordAuthResult>;
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
    let revision = 0;
    const adapter = createSupabaseAuthAdapter(client);
    adapterRef.current = adapter;

    async function publishUser(currentUser: SessionUser | null, currentRevision: number) {
      if (!active || revision !== currentRevision) return;
      // Password sign-in has no callback route to create the public profile.
      if (currentUser) await ensurePublicUser(client!, currentUser);
      if (!active || revision !== currentRevision) return;
      setUser(currentUser);
      setStatus(currentUser ? "signed-in" : "signed-out");
    }

    function failedBootstrap(currentRevision: number) {
      if (!active || revision !== currentRevision) return;
      setUser(null);
      setStatus("signed-out");
    }

    const initialRevision = revision;
    void adapter.getCurrentUser().then((currentUser) => publishUser(currentUser, initialRevision))
      .catch(() => failedBootstrap(initialRevision));

    const unsubscribe = adapter.subscribe((nextUser) => {
      if (!active) return;
      const currentRevision = ++revision;
      void publishUser(nextUser, currentRevision).catch(() => failedBootstrap(currentRevision));
    });

    return () => {
      active = false;
      adapterRef.current = null;
      unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<PasswordAuthResult> => {
    if (!adapterRef.current) return { ok: false, message: "Supabase sign-in is not configured." };
    return adapterRef.current.signInWithPassword(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, next?: string): Promise<PasswordAuthResult> => {
    if (!adapterRef.current) return { ok: false, message: "Supabase sign-in is not configured." };
    return adapterRef.current.signUp(email, password, next);
  }, []);

  const requestMagicLink = useCallback(async (email: string, next?: string): Promise<MagicLinkResult> => {
    const adapter = adapterRef.current;
    if (!adapter) return { ok: false, message: "Supabase sign-in is not configured." };
    return adapter.requestMagicLink(email, next);
  }, []);

  const signOut = useCallback(async () => {
    await adapterRef.current?.signOut();
    setUser(null);
    setStatus("signed-out");
  }, []);

  return <SessionContext.Provider value={{ user, status, requestMagicLink, signInWithPassword, signUp, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
