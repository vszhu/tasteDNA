"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { isValidEmail } from "@/lib/auth/friend-rules";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up" | "email-link";
const inputClass = "mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40";

export default function SignInPage() {
  const { user, status, requestMagicLink, signInWithPassword, signUp, signOut } = useSession();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function changeMode(next: Mode) {
    setMode(next);
    setPassword("");
    setNotice(null);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (!isValidEmail(email)) { setError("Enter a valid email address."); return; }
    setError(null);
    setNotice(null);
    setSending(true);
    try {
      const address = email.trim().toLowerCase();
      if (mode === "email-link") {
        const result = await requestMagicLink(address);
        if (result.ok) setNotice("Check your inbox for a sign-in link. If a link can be sent to this address, it may take a minute to arrive.");
        else setError(result.message);
      } else {
        const result = await (mode === "sign-up" ? signUp(address, password) : signInWithPassword(address, password));
        if (!result.ok) { setError(result.message); return; }
        setPassword("");
        if (result.needsConfirmation) {
          setNotice("Check your inbox to confirm your email, then sign in with your password. If you already have an account, sign in instead.");
        } else {
          setNotice("Sign-in complete. Opening your account…");
        }
      }
    } catch {
      setError("We couldn't connect to sign-in. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function switchAccount() {
    setSending(true);
    setError(null);
    try {
      await signOut();
      setPassword("");
      setNotice(null);
      setEmail("");
      setMode("sign-in");
    } catch {
      setError("We couldn't sign you out. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (status === "loading") {
    return <p role="status" className="px-4 py-16 text-center text-[var(--muted)]">Checking your account…</p>;
  }

  if (status === "signed-in" && user) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <h1 className="text-4xl">You&rsquo;re signed in as {user.displayName}.</h1>
          <p className="mt-3 text-[var(--muted)]">{user.email}</p>
          <Link href="/friends" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>
            Go to friends <ArrowRight className="size-4" />
          </Link>
          <div className="mt-5"><button type="button" onClick={switchAccount} disabled={sending} className="text-sm font-semibold underline underline-offset-4 disabled:opacity-50">{sending ? "Signing out…" : "Sign out / switch account"}</button></div>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-16">
      <div className="w-full">
        <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">YOUR TASTEDNA ACCOUNT</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Good food. Better company.</h1>
        <p className="mt-4 text-[var(--muted)]">Connect with friends and plan meals together. Your solo TasteDNA doesn&rsquo;t need an account.</p>

        <div className="mt-7 flex gap-2" aria-label="Account access">
          {([ ["sign-in", "Sign in"], ["sign-up", "Create account"] ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mode === value} disabled={sending} onClick={() => changeMode(value)} className={cn("flex-1 rounded-full border px-4 py-2.5 text-sm font-bold disabled:opacity-50", mode === value ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white")}>{label}</button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="email" className="text-sm font-bold">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" required disabled={sending} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} />
          {mode !== "email-link" && (
            <div className="mt-4">
              <label htmlFor="password" className="text-sm font-bold">Password</label>
              <input id="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={mode === "sign-up" ? 6 : undefined} disabled={sending} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
              {mode === "sign-up" && <p className="mt-2 text-xs text-[var(--muted)]">Use at least 6 characters. You may need to confirm your email.</p>}
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
          {notice && <div role="status" className="mt-4 flex gap-2 rounded-2xl border border-[var(--line)] bg-white p-4 text-sm leading-6"><Mail className="mt-1 size-4 shrink-0 text-[var(--tomato)]" /><p>{notice}</p></div>}
          <Button type="submit" size="lg" variant="accent" className="mt-5 w-full" disabled={sending}>
            {sending ? "Please wait…" : mode === "sign-up" ? "Create my account" : mode === "email-link" ? "Send magic link" : "Sign in with password"}
          </Button>
        </form>
        <button type="button" disabled={sending} onClick={() => changeMode(mode === "email-link" ? "sign-in" : "email-link")} className="mt-4 w-full text-center text-sm font-semibold text-[var(--muted)] underline underline-offset-4 disabled:opacity-50">{mode === "email-link" ? "Use a password instead" : "Use an email link instead"}</button>
        <div className="mt-8 border-t border-[var(--line)] pt-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><Sparkles className="size-3.5" /> Skip for now — continue solo</Link>
        </div>
      </div>
    </section>
  );
}
