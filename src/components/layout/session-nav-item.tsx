"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/providers/session-provider";
import { signInPath } from "@/lib/auth/callback";

export function SessionNavItem() {
  const pathname = usePathname();
  const { user, status } = useSession();

  if (status === "loading") return <span className="size-9 shrink-0 animate-pulse rounded-full bg-black/5" aria-hidden="true" />;

  if (status === "signed-in" && user) {
    return (
      <Link
        href="/friends"
        aria-label={`Signed in as ${user.displayName} — go to friends`}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-sm font-bold text-white transition-transform active:scale-95"
      >
        {user.displayName.slice(0, 1).toUpperCase()}
      </Link>
    );
  }

  return (
    <Link href={pathname.startsWith("/sessions/") ? signInPath(pathname) : "/sign-in"} className="shrink-0 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition-colors hover:border-[var(--ink)]">
      Sign in
    </Link>
  );
}
