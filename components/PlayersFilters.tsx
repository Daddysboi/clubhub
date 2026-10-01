"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type FilterTournament = { id: string; name: string };

/**
 * Players page search and filter toolbar.
 *
 * Search and its submit button share one row at every width — the search field
 * is the only control that matters on arrival, and a wrapped button used to
 * drop below the fold on a phone. The competition filter hides behind a toggle
 * because it is a secondary refinement, and an always-open select narrowed the
 * field to a few characters on a small screen.
 *
 * A plain GET form: no client state to keep in sync with the URL, so a shared
 * or bookmarked link reproduces exactly what the visitor sees.
 */
export function PlayersFilters({
  tournaments,
  query,
  scope,
}: {
  tournaments: FilterTournament[];
  query: string;
  scope?: string;
}) {
  // Open by default once a competition is chosen, otherwise the active filter
  // would be invisible behind a closed toggle.
  const [filtersOpen, setFiltersOpen] = useState(Boolean(scope));

  return (
    <form method="get" className="mb-6">
      <div className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search players…"
          aria-label="Search players"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="player-filters"
        >
          <FilterIcon />
          <span className="hidden sm:inline">Filters</span>
          {/* Dot rather than a count: the select is the only filter, and a badge
              would read as "3 filters" when nothing else is available. */}
          {scope ? (
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-[var(--pitch)]"
            />
          ) : null}
        </Button>
      </div>

      <div
        id="player-filters"
        hidden={!filtersOpen}
        className={cn("mt-2 flex flex-wrap items-center gap-2")}
      >
        <Select
          name="tournament"
          defaultValue={scope ?? ""}
          aria-label="Filter by competition"
          wrapperClassName="sm:max-w-xs"
        >
          <option value="">All competitions</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        {scope ? (
          <Link
            href={query ? `/players?q=${encodeURIComponent(query)}` : "/players"}
            className="rounded-lg px-2 py-2.5 text-sm font-medium text-[var(--ink-3)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
          >
            Clear filter
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** Sliders glyph; sits left of the label and stays decorative. */
function FilterIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className="size-4 shrink-0"
    >
      <path d="M3 6h14M6 10h8M8.5 14h3" />
    </svg>
  );
}