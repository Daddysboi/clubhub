import { useMemo } from "react";
import { Card, SectionHeading } from "@/components/ui/card";
import { StandingsTable } from "@/components/StandingsTable";
import { ScorerBoard } from "@/components/ScorerBoard";
import { AdminMatchEvents, type EventView } from "@/components/admin/AdminMatchEvents";
import { Stamp } from "@/components/ui/card";
import type { Match, Team } from "@/lib/db/schema";
import type { Standings } from "@/lib/standings";
import type { TopScorer } from "@/lib/stats";

type PlayerLite = {
  id: string;
  fullName: string;
  nickname: string | null;
  teamId: string | null;
};

/** Flattens a stats row into the flat shape the ScorerBoard table renders. */
function toScorerRow(s: TopScorer) {
  return {
    playerName: s.player.fullName,
    nickname: s.player.nickname,
    teamName: s.teamName,
    goals: s.goals,
    penalties: s.penalties,
    yellowCards: s.yellowCards,
    redCards: s.redCards,
    rank: s.rank,
  };
}

/** Collapsible live panel: useful when entering multiple matches in a row. */
export function AdminLiveStats({
  tournamentName,
  teams,
  matches,
  standings,
  players,
  scorers,
  events,
}: {
  tournamentName: string;
  teams: Team[];
  matches: Match[];
  standings: Standings;
  players: PlayerLite[];
  scorers: TopScorer[];
  events: Record<string, EventView[]>;
}) {
  const live = matches.filter((m) => m.status === "live");

  // Scorers are editable for any match that has kicked off, not just live
  // ones — organisers routinely enter results after the final whistle, and
  // stats only count FINISHED matches, so a live-only form would leave them
  // with nowhere to enter a goal after setting the score.
  const scorable = matches.filter((m) => m.status !== "scheduled");

  const inPlay = useMemo(
    () =>
      scorable.length > 0 ? (
        <div className="space-y-3">
          {scorable.map((m) => {
            const home = teams.find((t) => t.id === m.homeTeamId);
            const away = teams.find((t) => t.id === m.awayTeamId);
            const isLive = m.status === "live";
            return (
              <Card key={m.id} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isLive ? (
                      <Stamp tone="live">
                        <span className="size-1.5 animate-pulse rounded-full bg-[var(--live)]" />
                        Live
                      </Stamp>
                    ) : (
                      <Stamp tone="pitch">Full time</Stamp>
                    )}
                    <span className="text-xs text-[var(--ink-3)]">Round {m.round}</span>
                  </div>
                  <span className="text-lg font-black tabular-nums text-[var(--ink)]">
                    {m.homeScore ?? 0}–{m.awayScore ?? 0}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {home?.name ?? "—"} vs {away?.name ?? "—"}
                </p>

                <div className="mt-3">
                  <AdminMatchEvents
                    match={m}
                    teams={teams}
                    players={players}
                    events={events[m.id] ?? []}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      ) : null,
    [scorable, teams, players, events],
  );

  return (
    <section>
      <SectionHeading title="Live control centre" eyebrow="Matchday" />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-[var(--ink)]">{tournamentName}</h3>
          <Stamp tone={live.length > 0 ? "live" : "warn"}>
            {live.length === 1 ? "1 match in play" : `${live.length} matches in play`}
          </Stamp>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--ink-3)]">
              Scorers &amp; cards
            </h4>
            {inPlay ?? (
              <p className="ruling rounded-lg border border-[var(--rule)] px-4 py-8 text-center text-sm text-[var(--ink-3)]">
                No matches have kicked off yet. Open a fixture and set its status to Live or
                Finished from the Fixtures tab, then record each goal here.
              </p>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--ink-3)]">
                Standings
              </h4>
              <Card className="overflow-hidden">
                <StandingsTable standings={standings} />
              </Card>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--ink-3)]">
                Top scorers
              </h4>
              <ScorerBoard standings={scorers.map(toScorerRow)} />
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}