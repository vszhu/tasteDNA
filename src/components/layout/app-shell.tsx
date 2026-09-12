"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dna, House, MapPin, ScanLine, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: House },
  { href: "/onboarding", label: "Rate", icon: Sparkles },
  { href: "/venues", label: "Venues", icon: MapPin },
  { href: "/dashboard", label: "TasteDNA", icon: Dna },
  { href: "/decode", label: "Decode", icon: ScanLine },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--line)]/80 bg-[var(--cream)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-[-.03em]">
            <BrandMark />
            <span className="text-lg">TasteDNA</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary navigation">
            {nav.slice(1).map((item) => (
              <Link key={item.href} href={item.href} className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", pathname.startsWith(item.href) ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]")}>{item.label}</Link>
            ))}
          </nav>
          <Link href="/decode" className="hidden rounded-full bg-[var(--tomato)] px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 md:block">Decode a menu</Link>
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)] pb-24 sm:pb-0">{children}</main>
      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-white/70 bg-[var(--ink)]/95 p-1.5 shadow-2xl backdrop-blur-xl sm:hidden" aria-label="Mobile navigation">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors", active ? "bg-white text-[var(--ink)]" : "text-white/65")}><Icon className="size-4" />{item.label}</Link>;
        })}
      </nav>
    </>
  );
}
