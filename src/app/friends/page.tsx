"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, Mail, RefreshCw, UserPlus, Users, X } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SessionUser } from "@/lib/auth/types";
import { isValidEmail } from "@/lib/auth/friend-rules";
import {
  createFriendshipClient,
  FriendshipClientError,
} from "@/lib/friendships/client";
import type { FriendshipApiSummary } from "@/lib/friendships/types";
import { cn } from "@/lib/utils";

const NEUTRAL_SEND_MESSAGE = "If that email has an account, they'll see your request.";
const friendshipClient = createFriendshipClient();

function FriendRow({
  friend,
  responding,
  onRespond,
}: {
  friend: FriendshipApiSummary;
  responding?: boolean;
  onRespond?: (id: string, action: "accept" | "reject") => void;
}) {
  const pendingIncoming = friend.status === "pending" && friend.direction === "incoming";
  const pendingOutgoing = friend.status === "pending" && friend.direction === "outgoing";

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-bold">{friend.friendDisplayName}</p>
          <p className="truncate text-xs text-[var(--muted)]">TasteDNA member</p>
        </div>
        {pendingIncoming && onRespond ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" disabled={responding} aria-label={`Accept ${friend.friendDisplayName}`} onClick={() => onRespond(friend.friendshipId, "accept")} className="grid size-9 place-items-center rounded-full bg-[var(--tomato)] text-white transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60">
              <Check className="size-4" />
            </button>
            <button type="button" disabled={responding} aria-label={`Decline ${friend.friendDisplayName}`} onClick={() => onRespond(friend.friendshipId, "reject")} className="grid size-9 place-items-center rounded-full border border-[var(--line)] transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60">
              <X className="size-4" />
            </button>
          </div>
        ) : pendingOutgoing ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Clock className="size-3.5" /> Pending</span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#315e4b]"><Check className="size-3.5" /> Friends</span>
        )}
      </CardContent>
    </Card>
  );
}

export default function FriendsPage() {
  const { user, status } = useSession();
  if (status === "loading") {
    return <section className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--muted)]">Loading…</section>;
  }

  if (status === "signed-out" || !user) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center">
        <div className="w-full">
          <Users className="mx-auto size-9 text-[var(--tomato)]" />
          <h1 className="mt-5 text-4xl">Sign in to see friends.</h1>
          <p className="mt-3 text-[var(--muted)]">Friending is only available to signed-in users.</p>
          <Link href="/sign-in" className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-7")}>Sign in</Link>
        </div>
      </section>
    );
  }

  return <FriendsAccount key={user.id} user={user} />;
}

function FriendsAccount({ user }: { user: SessionUser }) {
  const [friends, setFriends] = useState<FriendshipApiSummary[] | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(false);
  const pendingList = useRef<AbortController | null>(null);
  const mutating = useRef(false);

  const refresh = useCallback(async () => {
    if (!active.current) return;
    pendingList.current?.abort();
    const controller = new AbortController();
    pendingList.current = controller;
    setRefreshing(true);
    try {
      const list = await friendshipClient.list(controller.signal);
      if (!active.current || controller.signal.aborted) return;
      setFriends(list);
      setLoadError(null);
    } catch (error) {
      if (!active.current || controller.signal.aborted) return;
      setLoadError(error instanceof FriendshipClientError ? error.message : "Friendships are temporarily unavailable. Please try again.");
    } finally {
      if (active.current && !controller.signal.aborted) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    // Account changes remount this component and abort the previous account's read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !mutating.current) void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 15000);
    return () => {
      active.current = false;
      pendingList.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) { setFeedback({ tone: "error", text: "Enter a valid email address." }); return; }
    if (mutating.current) return;
    mutating.current = true;
    setSending(true);
    setFeedback(null);
    try {
      const message = await friendshipClient.request(email);
      if (!active.current) return;
      setFeedback({ tone: "ok", text: message || NEUTRAL_SEND_MESSAGE });
      setEmail("");
      await refresh();
    } catch (error) {
      if (!active.current) return;
      setFeedback({
        tone: "error",
        text:
          error instanceof FriendshipClientError
            ? error.message
            : "Friendships are temporarily unavailable. Please try again.",
      });
    } finally {
      mutating.current = false;
      if (active.current) setSending(false);
    }
  }

  async function respond(friendshipId: string, action: "accept" | "reject") {
    if (mutating.current) return;
    mutating.current = true;
    setRespondingId(friendshipId);
    setFeedback(null);
    try {
      await friendshipClient.respond(friendshipId, action);
      await refresh();
    } catch (error) {
      if (!active.current) return;
      setFeedback({
        tone: "error",
        text:
          error instanceof FriendshipClientError
            ? error.message
            : "Friendships are temporarily unavailable. Please try again.",
      });
    } finally {
      mutating.current = false;
      if (active.current) setRespondingId(null);
    }
  }

  const incoming = (friends ?? []).filter(
    (friend) => friend.status === "pending" && friend.direction === "incoming",
  );
  const outgoing = (friends ?? []).filter(
    (friend) => friend.status === "pending" && friend.direction === "outgoing",
  );
  const accepted = (friends ?? []).filter((friend) => friend.status === "accepted");

  return (
    <div className="mx-auto max-w-2xl px-4 py-9 sm:px-6 sm:py-14">
      <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">FRIENDS</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Who&rsquo;s in your circle?</h1>
      <p className="mt-4 text-[var(--muted)]">Connect with the people you love eating with.</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
        <span>Signed in as {user.email}</span>
        <Link href="/sign-in" className="font-semibold underline underline-offset-4">Switch account</Link>
        <button type="button" disabled={refreshing || sending || respondingId !== null} onClick={() => void refresh()} className="ml-auto flex items-center gap-1.5 font-semibold disabled:opacity-50"><RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> {refreshing ? "Refreshing…" : "Refresh friends"}</button>
      </div>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="friend-email" className="sr-only">Friend&rsquo;s email</label>
          <input
            id="friend-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="friend@example.com"
            className="w-full rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
          />
        </div>
        <Button type="submit" variant="accent" disabled={sending || respondingId !== null} className="shrink-0">
          <UserPlus className="size-4" /> {sending ? "Sending…" : "Add friend"}
        </Button>
      </form>
      {feedback && (
        <p role={feedback.tone === "error" ? "alert" : "status"} className={cn("mt-3 flex items-center gap-2 text-sm font-semibold", feedback.tone === "error" ? "text-red-700" : "text-[#315e4b]")}>
          <Mail className="size-3.5 shrink-0" /> {feedback.text}
        </p>
      )}

      {loadError && <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError} {friends !== null ? "Showing your last loaded list. " : ""}Use Refresh friends to retry.</p>}
      {friends === null ? (
        !loadError && <p role="status" className="mt-10 text-center text-sm text-[var(--muted)]">Loading friends…</p>
      ) : (
        <div className="mt-10 space-y-8">
          {incoming.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">WAITING ON YOU</h2>
              <div className="mt-3 space-y-2">{incoming.map((friend) => <FriendRow key={friend.friendshipId} friend={friend} responding={sending || respondingId !== null} onRespond={respond} />)}</div>
            </section>
          )}
          <section>
            <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">FRIENDS</h2>
            {accepted.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">No friends yet — add someone above.</p>
            ) : (
              <div className="mt-3 space-y-2">{accepted.map((friend) => <FriendRow key={friend.friendshipId} friend={friend} />)}</div>
            )}
          </section>
          {outgoing.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">SENT</h2>
              <div className="mt-3 space-y-2">{outgoing.map((friend) => <FriendRow key={friend.friendshipId} friend={friend} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
