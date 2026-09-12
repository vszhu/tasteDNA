import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]",
  {
    variants: {
      variant: {
        default: "bg-[var(--ink)] text-white shadow-sm hover:bg-[#293b34] hover:shadow-md",
        accent: "bg-[var(--tomato)] text-white shadow-sm hover:bg-[#bd422f] hover:shadow-md",
        outline: "border border-[var(--line)] bg-white/80 text-[var(--ink)] hover:border-[var(--ink)] hover:bg-white",
        ghost: "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
