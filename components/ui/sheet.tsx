"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Sheet — the one modal idiom in CupShub.
 *
 * Mobile: slides up from the bottom edge as a full-width sheet, capped at
 * 90dvh so the browser chrome never squeezes it, with a grab handle and
 * safe-area padding so it clears the home indicator.
 * Desktop (sm+): a centred dialog.
 *
 * One DOM tree, not two — the breakpoint is handled with utility classes so
 * state, focus and form contents can never diverge between the two renders.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** md = 28rem, lg = 36rem, xl = 48rem */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + lock the page behind the sheet so the content
  // underneath cannot scroll on a touch device.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    // Move focus into the sheet so keyboard and screen-reader users land here.
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-3xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl",
          "border border-[var(--rule-strong)] bg-[var(--surface)] shadow-2xl",
          "pb-safe outline-none sm:rounded-xl sm:pb-0",
          maxWidth,
          className,
        )}
      >
        {/* Grab handle — mobile affordance that the sheet can be dismissed. */}
        <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
          <span aria-hidden className="h-1.5 w-11 rounded-full bg-[var(--rule-strong)]" />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-[var(--ink)]">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-snug text-[var(--ink-3)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--ink-3)] transition hover:bg-[var(--sunken)] hover:text-[var(--ink)] active:scale-95"
          >
          <span aria-hidden className="size-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
          </button>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-[var(--rule)] bg-[var(--sunken)] px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}