"use client";

import { useRef } from "react";

/**
 * Fixture rail with real keyboard controls.
 *
 * The snap carousel is still one line on phones, but a focusable region and
 * labelled Previous/Next buttons mean keyboard users are not stranded on the
 * first one or two cards. The heading lives here so the controls sit beside it
 * instead of adding another row of UI.
 */
export function MatchRail({
  title,
  countLabel,
  children,
}: {
  title: string;
  countLabel: string;
  children: React.ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({
      left: direction * Math.max(240, rail.clientWidth * 0.8),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ink-3)]">
          {title}
        </h3>
        <span aria-hidden className="h-px flex-1 bg-[var(--rule)]" />
        <span className="text-[11px] tabular-nums text-[var(--ink-3)]">{countLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`Scroll ${title} left`}
            className="grid size-9 place-items-center rounded-lg border border-[var(--rule-strong)] text-base text-[var(--ink-2)] transition hover:bg-[var(--sunken)] max-sm:size-11"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`Scroll ${title} right`}
            className="grid size-9 place-items-center rounded-lg border border-[var(--rule-strong)] text-base text-[var(--ink-2)] transition hover:bg-[var(--sunken)] max-sm:size-11"
          >
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        role="region"
        aria-label={`${title} fixtures`}
        tabIndex={0}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1"
      >
        {children}
      </div>
    </div>
  );
}
