"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Single button idiom. Default size is `lg` = 44px = the touch floor.
 * The combined transition keeps the hover fade alive (a split
 * transition-colors + transition-transform would not).
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold select-none whitespace-nowrap " +
    "transition-[color,background-color,border-color,transform] duration-150 ease-out " +
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pitch)]/50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--pitch)] text-[var(--accent-ink)] hover:bg-[var(--pitch-hover)]",
        secondary:
          "bg-[var(--surface)] text-[var(--ink-2)] border border-[var(--rule-strong)] hover:text-[var(--ink)]",
        ghost:
          "bg-transparent text-[var(--ink-3)] hover:bg-[var(--sunken)] hover:text-[var(--ink)]",
        destructive:
          "border border-[var(--live)]/50 text-[var(--live)] hover:bg-[var(--live-tint)]",
      },
      size: {
        // sm/md are for desktop-dense rows. On a phone every button grows to
        // the 44px floor — see the `min-h` inversion in globals.css.
        sm: "h-9 min-h-9 px-3 text-sm max-sm:min-h-11",
        md: "h-10 min-h-10 px-4 text-sm max-sm:min-h-11",
        lg: "h-11 min-h-11 px-5 text-base",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, block, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  },
);