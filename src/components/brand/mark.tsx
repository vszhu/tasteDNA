import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-grid size-8 place-items-center", className)}>
      <span className="absolute inset-[2px] rotate-45 rounded-[45%_55%_45%_55%] bg-[var(--tomato)]" />
      <span className="relative size-2 rounded-full bg-[var(--cream)]" />
    </span>
  );
}
