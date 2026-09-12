"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Mail, UserPlus, Users, X } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockFriendsAdapter } from "@/lib/auth/mock-adapter";
import { isValidEmail } from "@/lib/auth/friend-rules";
import type { Friend } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const NEUTRAL_SEND_MESSAGE = "If that email has an account, they'll see your request.";

function FriendRow({ friend, onRespond }: { friend: Friend; onRespond?: (id: string, action: "accept" | "reject") => void }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-bold">{friend.user.displayName}</p>
          <p className="truncate text-xs text-[var(--muted)]">{friend.user.email}</p>
        </div>
        {friend.status === "pending-incoming" && onRespond ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" aria-label={`Accept ${friend.user.displayName}`} onClick={() => onRespond(friend.friendshipId, "accept")} className="grid size-9 place-items-center rounded-full bg-[var(--tomato)] text-white transition-transform active:scale-95">
              <Check className="size-4" />
            </button>
            <button type="button" aria-label={`Decline ${friend.user.displayName}`} onClick={() => onRespond(friend.friendshipId, "reject")} className="grid size-9 place-items-center rounded-full border border-[var(--line)] transition-transform active:scale-95">
              <X className="size-4" />
            </button>
          </div>
        ) : friend.status === "pending-outgoing" ? (
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
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const list = await mockFriendsAdapter.listFriends();
    setFriends(list);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === "signed-in") refresh();
  }, [status, refresh]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) { setFeedback({ tone: "error", text: "Enter a valid email address." }); return; }
    setSending(true);
    const result = await mockFriendsAdapter.sendFriendRequest(email);
    setSending(false);
    if (result.ok || result.reason === "already-pending" || result.reason === "already-friends") {
      setFeedback({ tone: "ok", text: NEUTRAL_SEND_MESSAGE });
      setEmail("");
      await refresh();
    } else if (result.reason === "self") {
      setFeedback({ tone: "error", text: "That's your own email." });
    } else {
      setFeedback({ tone: "error", text: "Enter a valid email address." });
    }
  }

  async function respond(friendshipId: string, action: "accept" | "reject") {
    const updated = await mockFriendsAdapter.respondToRequest(friendshipId, action);
    setFriends(updated);
  }

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

  const incoming = (friends ?? []).filter((friend) => friend.status === "pending-incoming");
  const outgoing = (friends ?? []).filter((friend) => friend.status === "pending-outgoing");
  const accepted = (friends ?? []).filter((friend) => friend.status === "accepted");

  return (
    <div className="mx-auto max-w-2xl px-4 py-9 sm:px-6 sm:py-14">
      <p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">FRIENDS</p>
      <h1 className="mt-3 text-5xl sm:text-6xl">Who&rsquo;s in your circle?</h1>
      <p className="mt-4 text-[var(--muted)]">Friend people to invite them to group dining sessions.</p>

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
            placeholder="friend@andrew.cmu.edu"
            className="w-full rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--tomato)]/40"
          />
        </div>
        <Button type="submit" variant="accent" disabled={sending} className="shrink-0">
          <UserPlus className="size-4" /> {sending ? "Sending…" : "Add friend"}
        </Button>
      </form>
      {feedback && (
        <p role={feedback.tone === "error" ? "alert" : "status"} className={cn("mt-3 flex items-center gap-2 text-sm font-semibold", feedback.tone === "error" ? "text-red-700" : "text-[#315e4b]")}>
          <Mail className="size-3.5 shrink-0" /> {feedback.text}
        </p>
      )}

      {friends === null ? (
        <p className="mt-10 text-center text-sm text-[var(--muted)]">Loading friends…</p>
      ) : (
        <div className="mt-10 space-y-8">
          {incoming.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-[.14em] text-[var(--muted)]">WAITING ON YOU</h2>
              <div className="mt-3 space-y-2">{incoming.map((friend) => <FriendRow key={friend.friendshipId} friend={friend} onRespond={respond} />)}</div>
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
