import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayersForTournament,
  getTournamentBySlug,
  getTournamentMatches,
  getTournamentStats,
  getTournamentTeamsWithCaptains,
  getMatchEvents,
} from "@/lib/db/queries";
import { Card, EmptyState, SectionHeading, Stamp, StatusSpine } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/MatchCard";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerRow } from "@/components/PlayerRow";
import { ScorerBoard } from "@/components/ScorerBoard";
import { formatDate, formatDateTime } from "@/lib/format";
import { statusLabel, statusTone } from "@/lib/tones";
import type { Team, Match, Player } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const [teamList, matchList, roster, stats] = await Promise.all([
    getTournamentTeamsWithCaptains(tournament.id),
    getTournamentMatches(tournament.id),
    getPlayersForTournament(tournament.id),
    getTournamentStats(tournament.id),
  ]);

  const teamMap = new Map(teamList.map((t) => [t.id, t as Team]));
  const playerMap = new Map(roster.map((p) => [p.id, p as Player & { teamId: string | null }]));

  const squadCount = new Map<string, number>();
  for (const p of roster) {
    if (p.teamId) squadCount.set(p.teamId, (squadCount.get(p.teamId) ?? 0) + 1);
  }

  const champion = tournament.winnerTeamId ? teamMap.get(tournament.winnerTeamId) : null;

  const byRound = new Map<number, Match[]>();
  for (const m of matchList) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  const assigned = roster.filter((p) => p.teamId).length;
  const goldenBoot = stats.scorers[0] ?? null;

  // Event lookup per match, only for matches that are finished or live.
  const eventMap = new Map<string, Awaited<ReturnType<typeof getMatchEvents>>>();
  await Promise.all(
    matchList
      .filter((m) => m.status === "finished" || m.status === "live")
      .map(async (m) => {
        eventMap.set(m.id, await getMatchEvents(m.id));
      }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Link href="/tournaments" className="text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)]">
        ← All tournaments
      </Link>

      <section className="relative mt-4 overflow-hidden rounded-xl border border-[var(--rule)] bg-gradient-to-br from-[var(--surface)] to-[var(--pitch)]/10 p-6 sm:p-10">
        <Stamp tone={statusTone(tournament.status)}>{statusLabel(tournament.status)}</Stamp>
        <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-[var(--ink)] sm:text-4xl">
          {tournament.name}
        </h1>
        {tournament.clubName ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink-3)]">
            <span className="size-1.5 rounded-full bg-[var(--pitch)]" aria-hidden />
            {tournament.clubName}
          </p>
        ) : null}
        {tournament.description ? (
          <p className="mt-3 max-w-2xl leading-relaxed text-[var(--ink-2)]">
            {tournament.description}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
          <Fact label="Venue" value={tournament.venue ?? "TBC"} />
          <Fact label="Starts" value={tournament.startDate ? formatDate(tournament.startDate) : "TBC"} />
          <Fact label="Teams" value={String(teamList.length)} />
          <Fact label="Players" value={`${roster.length} registered`} />
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/join/${tournament.slug}`}>
            <Button>Register to play</Button>
          </Link>
          <a href="#standings">
            <Button variant="secondary">View standings</Button>
          </a>
        </div>
      </section>

      {champion ? (
        <section className="mt-8">
          <Card className="relative overflow-hidden border-[var(--trophy)]/40 bg-[var(--trophy-tint)] p-6">
            <StatusSpine tone="trophy" />
            <div className="flex flex-wrap items-center gap-4">
              <TeamCrest team={champion} size={56} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--trophy)]">Champion</p>
                <p className="text-2xl font-black text-[var(--ink)]">{champion.name}</p>
                <p className="mt-0.5 text-sm text-[var(--ink-3)]">
                  {stats.standings[0]?.points ?? 0} points from {stats.standings[0]?.played ?? 0}{" "}
                  matches
                </p>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      {/* Awards row: Golden Boot + best attack + best defence */}
      {(goldenBoot || stats.bestAttack || stats.bestDefence) ? (
        <section className="mt-8">
          <SectionHeading title="Awards & records" eyebrow="Who won what" />
          <div className="grid gap-4 sm:grid-cols-3">
            {goldenBoot ? (
              <Card className="relative overflow-hidden border-[var(--pitch)]/40 bg-[var(--pitch-a12)] p-5">
                <StatusSpine tone="pitch" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--pitch)]">
                  Golden Boot
                </p>
                <p className="mt-2 text-lg font-black text-[var(--ink)]">{goldenBoot.player.fullName}</p>
                <p className="text-sm text-[var(--ink-3)]">
                  {goldenBoot.goals} {goldenBoot.goals === 1 ? "goal" : "goals"}
                  {goldenBoot.teamName ? ` · ${goldenBoot.teamName}` : ""}
                </p>
              </Card>
            ) : null}

            {stats.bestAttack ? (
              <Card className="relative overflow-hidden p-5">
                <StatusSpine tone="info" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--info)]">
                  Best attack
                </p>
                <p className="mt-2 text-lg font-black text-[var(--ink)]">
                  {stats.bestAttack.team.name}
                </p>
                <p className="text-sm text-[var(--ink-3)]">
                  {stats.bestAttack.goalsScored} goals scored
                </p>
              </Card>
            ) : null}

            {stats.bestDefence ? (
              <Card className="relative overflow-hidden p-5">
                <StatusSpine tone="pitch" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--pitch)]">
                  Best defence
                </p>
                <p className="mt-2 text-lg font-black text-[var(--ink)]">
                  {stats.bestDefence.team.name}
                </p>
                <p className="text-sm text-[var(--ink-3)]">
                  {stats.bestDefence.goalsConceded} conceded ·{" "}
                  {stats.bestDefence.cleanSheets} clean sheets
                </p>
              </Card>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading
          title="Teams"
          eyebrow="Squads"
          action={
            <span className="text-xs text-[var(--ink-3)]">
              {assigned} of {roster.length} players assigned
            </span>
          }
        />
        {teamList.length === 0 ? (
          <EmptyState title="Teams have not been created yet" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teamList.map((team) => (
              <Card key={team.id} className="relative overflow-hidden p-5">
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: team.color }} />
                <div className="flex items-center gap-3">
                  <TeamCrest team={team} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--ink)]">{team.name}</p>
                    <p className="text-xs text-[var(--ink-3)]">
                      {squadCount.get(team.id) ?? 0} players
                    </p>
                    {team.captainName ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--ink-3)]">
                        <span className="font-semibold text-[var(--ink-2)]">C</span>{" "}
                        {team.captainNickname
                          ? `${team.captainName} “${team.captainNickname}”`
                          : team.captainName}
                      </p>
                    ) : null}
                    {team.managerName ? (
                      <p className="truncate text-xs text-[var(--ink-3)]">
                        <span className="font-semibold text-[var(--ink-2)]">M</span>{" "}
                        {team.managerNickname
                          ? `${team.managerName} “${team.managerNickname}”`
                          : team.managerName}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="fixtures" className="mt-10 scroll-mt-20">
        <SectionHeading title="Fixtures & results" eyebrow="Schedule" />
        {rounds.length === 0 ? (
          <EmptyState
            title="No fixtures yet"
            hint="The organiser will publish the schedule once teams are confirmed."
          />
        ) : (
          <div className="space-y-8">
            {rounds.map(([round, roundMatches]) => (
              <div key={round}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--ink-3)]">
                  Round {round}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {roundMatches.map((m) => (
                    <div key={m.id} className="space-y-2">
                      <MatchCard match={m} teams={teamMap} />
                      {eventMap.has(m.id) && eventMap.get(m.id)!.length > 0 ? (
                        <ScorerBoard
                          events={eventMap.get(m.id)!.map((e) => ({
                            ...e,
                            playerName: e.playerId
                              ? (playerMap.get(e.playerId)?.fullName ?? null)
                              : null,
                            teamName: e.teamId ? (teamMap.get(e.teamId)?.name ?? null) : null,
                          }))}
                          compact
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="standings" className="mt-10 scroll-mt-20">
        <SectionHeading title="Standings" eyebrow="Table" />
        <Card className="overflow-hidden">
          <StandingsTable standings={stats.standings} />
        </Card>
        <p className="mt-2 text-xs text-[var(--ink-3)]">
          3 points for a win, 1 for a draw. Tie-break: goal difference, then goals scored.
        </p>
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Top scorers"
          eyebrow="Golden Boot"
          action={
            <span className="text-xs text-[var(--ink-3)]">
              {stats.scorers.length} scorers
            </span>
          }
        />
        <ScorerBoard
          standings={stats.scorers.map((s) => ({
            playerName: s.player.fullName,
            nickname: s.player.nickname,
            teamName: s.teamName,
            goals: s.goals,
            penalties: s.penalties,
            yellowCards: s.yellowCards,
            redCards: s.redCards,
            rank: s.rank,
          }))}
        />
      </section>

      <section className="mt-10">
        <SectionHeading title="Team stats" eyebrow="Records" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.teamStats.map((ts) => (
            <Card key={ts.team.id} className="p-4">
              <div className="flex items-center gap-2.5">
                <TeamCrest team={ts.team} size={28} />
                <span className="truncate font-bold text-[var(--ink)]">{ts.team.name}</span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Scored" value={ts.goalsScored} />
                <Row label="Conceded" value={ts.goalsConceded} />
                <Row label="Clean sheets" value={ts.cleanSheets} />
                <Row label="Biggest win" value={`+${ts.biggestWin}`} />
                <Row label="Cards" value={`${ts.yellowCards}Y ${ts.redCards}R`} />
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading title="Squads" eyebrow="Players" />
        <div className="grid gap-4 lg:grid-cols-2">
          {teamList.map((team) => {
            const squad = roster.filter((p) => p.teamId === team.id);
            return (
              <Card key={team.id} className="overflow-hidden">
                <header className="flex items-center gap-2.5 border-b border-[var(--rule)] px-4 py-3">
                  <TeamCrest team={team} size={28} />
                  <span className="font-bold text-[var(--ink)]">{team.name}</span>
                  <span className="ml-auto text-xs text-[var(--ink-3)]">{squad.length}</span>
                </header>
                {squad.length === 0 ? (
                  <p className="ruling px-4 py-6 text-center text-sm text-[var(--ink-3)]">
                    No players assigned yet
                  </p>
                ) : (
                  squad.map((p) => <PlayerRow key={p.id} player={p} />)
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading title="Match schedule" eyebrow="Kickoff times" />
        <Card className="divide-y divide-[var(--rule)]">
          {matchList.length === 0 ? (
            <p className="ruling px-4 py-8 text-center text-sm text-[var(--ink-3)]">
              Nothing scheduled.
            </p>
          ) : (
            matchList.map((m) => {
              const home = teamMap.get(m.homeTeamId);
              const away = teamMap.get(m.awayTeamId);
              if (!home || !away) return null;
              // A kickoff that has happened shows a score; a future one shows
              // "vs". Hoisted so the two branches cannot disagree.
              const started = m.status === "finished" || m.status === "live";
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-14 shrink-0 text-xs text-[var(--ink-3)]">R{m.round}</span>
                  <span className="w-32 shrink-0 text-xs text-[var(--ink-3)]">
                    {formatDateTime(m.scheduledAt)}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-end truncate text-sm text-[var(--ink)]">
                    {home.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-center text-sm font-black tabular-nums text-[var(--ink)]">
                    {started ? `${m.homeScore} – ${m.awayScore}` : "vs"}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center truncate text-sm text-[var(--ink)]">
                    {away.name}
                  </span>
                </div>
              );
            })
          )}
        </Card>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)]/50 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-3)]">{label}</p>
      <p className="mt-0.5 font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--ink-3)]">{label}</dt>
      <dd className="font-semibold tabular-nums text-[var(--ink-2)]">{value}</dd>
    </div>
  );
}