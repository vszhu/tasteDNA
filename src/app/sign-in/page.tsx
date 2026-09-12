"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { isValidEmail } from "@/lib/auth/friend-rules";
import { cn } from "@/lib/utils";

export default function SignInPage() {
  const { user, status, requestMagicLink, signInForDemo } = useSession();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) { setError("Enter a valid email address."); return; }
    setError(null);
    setSending(true);
    await requestMagicLink(email);
    setSending(false);
    setSent(true);
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
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-16">
      <div className="w-full">
        <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">SIGN IN</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Group dining needs a name.</h1>
        <p className="mt-4 text-[var(--muted)]">Sign in with your CMU email to friend people and plan meals together. Your solo TasteDNA doesn&rsquo;t need an account.</p>

        {sent ? (
          <div role="status" aria-live="polite" className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-5">
            <p className="flex items-center gap-2 font-semibold"><Mail className="size-4 text-[var(--tomato)]" /> Check your inbox.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">If that address has an account, we sent a magic link to sign in. It can take a minute to arrive.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8">
            <label htmlFor="email" className="text-sm font-bold">CMU email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@andrew.cmu.edu"
              className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
            />
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
            <Button type="submit" size="lg" variant="accent" className="mt-4 w-full" disabled={sending}>
              {sending ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}

        <div className="mt-8 border-t border-[var(--line)] pt-6">
          <button type="button" onClick={signInForDemo} className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
            <Sparkles className="size-3.5" /> Skip for now — continue with a demo account
          </button>
        </div>
      </div>
    </section>
  );
}
