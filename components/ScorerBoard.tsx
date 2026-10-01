import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/card";
import { EVENT_LABEL, EVENT_TONE } from "@/lib/stats";
import type { MatchEvent } from "@/lib/db/schema";

type Row = {
  playerName: string | null;
  nickname?: string | null;
  teamName: string | null;
  goals?: number;
  penalties?: number;
  yellowCards?: number;
  redCards?: number;
  rank?: number;
};

type EventRow = MatchEvent & { playerName: string | null; teamName: string | null };

/**
 * Two shapes, one component:
 *  - `standings`: the Golden Boot ladder (tournament-level)
 *  - `events`:    a match timeline (compact, under a scoreline)
 */
export function ScorerBoard({
  standings,
  events,
  compact = false,
}: {
  standings?: Row[];
  events?: EventRow[];
  compact?: boolean;
}) {
  if (events) {
    if (events.length === 0) return null;
    return (
      <Card className="overflow-hidden">
        <ul className="divide-y divide-[var(--rule)]">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="w-7 shrink-0 font-mono text-[var(--ink-3)]">
                {e.minute !== null ? `${e.minute}′` : "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]">
                {e.playerName ?? "Unknown"}
              </span>
              <Stamp tone={EVENT_TONE[e.type as keyof typeof EVENT_TONE] ?? "neutral"}>
                {EVENT_LABEL[e.type as keyof typeof EVENT_LABEL] ?? e.type}
              </Stamp>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const rows = standings ?? [];
  if (rows.length === 0) {
    return (
      <Card className="ruling px-6 py-10 text-center text-sm text-[var(--ink-3)]">
        No goals scored yet. Scorers appear here as matches are recorded.
      </Card>
    );
  }

  if (compact) return null;

  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Top scorers</caption>
          <thead>
            <tr className="border-b border-[var(--rule)] text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
              <th scope="col" className="px-4 py-3 text-left font-semibold">#</th>
              <th scope="col" className="px-2 py-3 text-left font-semibold">Player</th>
              <th scope="col" className="px-2 py-3 text-left font-semibold">Team</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">Goals</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">Pens</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">Y</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.playerName}-${r.rank}`}
                className="border-b border-[var(--rule)] last:border-0"
              >
                <td className="px-4 py-3 font-bold text-[var(--ink-3)]">{r.rank}</td>
                <td className="px-2 py-3">
                  <span className="font-semibold text-[var(--ink)]">{r.playerName}</span>
                  {r.nickname ? (
                    <span className="ml-1.5 text-xs text-[var(--ink-3)]">“{r.nickname}”</span>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-[var(--ink-3)]">{r.teamName ?? "—"}</td>
                <td className="px-2 py-3 text-center">
                  <span className="text-base font-black tabular-nums text-[var(--pitch)]">
                    {r.goals}
                  </span>
                </td>
                <td className="px-2 py-3 text-center tabular-nums text-[var(--ink-3)]">
                  {r.penalties ?? 0}
                </td>
                <td className="px-2 py-3 text-center tabular-nums text-[var(--warn)]">
                  {r.yellowCards ?? 0}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-[var(--live)]">
                  {r.redCards ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[var(--rule)] sm:hidden">
        {rows.map((r) => (
          <div key={`${r.playerName}-${r.rank}`} className="flex items-center gap-2.5 px-3 py-3">
            <span className="w-4 shrink-0 text-sm font-bold text-[var(--ink-3)]">{r.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{r.playerName}</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">
                {r.teamName ?? "Unassigned"}
                {r.yellowCards ? ` · ${r.yellowCards}Y` : ""}
                {r.redCards ? ` · ${r.redCards}R` : ""}
              </p>
            </div>
            <span className="shrink-0 text-xl font-black tabular-nums text-[var(--pitch)]">
              {r.goals}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}