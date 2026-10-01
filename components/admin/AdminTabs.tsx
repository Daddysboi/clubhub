"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AdminTab = {
  id: string;
  label: string;
  /** Short hint shown under the label on wide screens. */
  hint?: string;
  /** Count chip. Hidden when 0 or undefined. */
  badge?: number;
  content: ReactNode;
};

/**
 * Horizontal tab strip for the organiser panel.
 *
 * Tabs render eagerly and toggle with `hidden`, so a form the organiser has
 * half-filled survives switching tabs. That matters here: every panel holds
 * local React state (kit picker, in-progress fixture form) and remounting it
 * on tab switch would silently discard the organiser's input.
 */
export function AdminTabs({
  tabs,
  initial,
  leading,
  trailing,
}: {
  tabs: AdminTab[];
  initial?: string;
  /** Rendered before the tab strip, on the same row. */
  leading?: ReactNode;
  /** Rendered after the tab strip, on the same row. */
  trailing?: ReactNode;
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);

  return (
    <div>
      {/* One row: optional leading node, tabs, optional trailing node. The
          trailing item is pushed right with ml-auto so the tabs stay left
          aligned even when leading is absent. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        {leading}
        <div
          role="tablist"
          aria-label="Tournament admin sections"
          className="min-w-0 flex-1 overflow-x-auto"
        >
          <div className="flex min-w-max gap-1 border-b border-[var(--rule)] pb-px">
            {tabs.map((tab) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm transition",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]",
                    selected
                      ? "font-semibold text-[var(--ink)]"
                      : "text-[var(--ink-3)] hover:text-[var(--ink)]",
                  )}
                >
                  <span className={cn(selected && "text-[var(--pitch)]")}>{tab.label}</span>
                  {tab.badge ? (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-px text-[11px] font-semibold leading-tight",
                        selected
                          ? "bg-[var(--pitch-a12)] text-[var(--pitch)]"
                          : "bg-[var(--rule)] text-[var(--ink-3)]",
                      )}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition",
                      selected ? "bg-[var(--pitch)]" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
        {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}