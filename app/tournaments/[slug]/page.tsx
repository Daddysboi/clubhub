import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPlayersForTournament,
  getTournamentBySlug,
  getTournamentMatches,
  getTournamentStats,
  getTournamentTeamsWithCaptains,
  getMatchEvents,
  getTournamentMemories,
} from "@/lib/db/queries";
import { Card, EmptyState, SectionHeading, Stamp, StatusSpine } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import { MatchCard } from "@/components/MatchCard";
import { MatchRail } from "@/components/MatchRail";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerRow } from "@/components/PlayerRow";
import { ScorerBoard } from "@/components/ScorerBoard";
import { MemoryGallery, type GalleryPhoto } from "@/components/MemoryGallery";
import { formatDateTime } from "@/lib/format";
import { bestAttackGrouped, bestDefenceGrouped, groupTopScorers } from "@/lib/stats";
import { statusLabel, statusTone } from "@/lib/tones";
import { formatLabel, stageLabel, stageOrder } from "@/lib/stages";
import type { Match, Player, Team } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") return { title: "Cup not found" };
  const description =
    tournament.description ?? `Fixtures, standings and memories from ${tournament.name}.`;
  return {
    title: tournament.name,
    description,
    alternates: { canonical: `/tournaments/${tournament.slug}` },
    openGraph: { title: tournament.name, description, url: `/tournaments/${tournament.slug}` },
  };
}

/**
 * Public tournament hub.
 *
 * One hero, one album, and three working areas — match centre + table,
 * statistics, and squads. Nothing is repeated in two places, and every
 * section is reachable from the sticky rail under the hero.
 */
export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ photo?: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const { photo } = await searchParams;
  const initialPhotoId = typeof photo === "string" ? photo : null;

  const tournament = await getTournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const [teamList, matchList, roster, stats, memories] = await Promise.all([
    getTournamentTeamsWithCaptains(tournament.id),
    getTournamentMatches(tournament.id),
    getPlayersForTournament(tournament.id),
    getTournamentStats(tournament.id),
    getTournamentMemories(tournament.id),
  ]);

  const teamMap = new Map(teamList.map((t) => [t.id, t as Team]));
  const playerMap = new Map(roster.map((p) => [p.id, p as Player & { teamId: string | null }]));

  const matchLabel = new Map(
    matchList.map((m) => [
      m.id,
      `${stageLabel(m.stage, m.round, tournament.format)} · ${teamMap.get(m.homeTeamId)?.name ?? "?"} vs ${
        teamMap.get(m.awayTeamId)?.name ?? "?"
      }`,
    ]),
  );

  const galleryPhotos: GalleryPhoto[] = memories.map((m) => ({
    id: m.id,
    url: m.url,
    caption: m.caption,
    label: m.matchId ? (matchLabel.get(m.matchId) ?? null) : null,
    width: m.width,
    height: m.height,
  }));

  const byRound = new Map<string, { stage: string; round: number; matches: Match[] }>();
  for (const m of matchList) {
    const stage = m.stage ?? "group";
    const key = `${stage}:${m.round}`;
    const group = byRound.get(key) ?? { stage, round: m.round, matches: [] };
    group.matches.push(m);
    byRound.set(key, group);
  }
  const rounds = [...byRound.values()].sort(
    (a, b) => stageOrder(a.stage) - stageOrder(b.stage) || a.round - b.round,
  );
  const finished = matchList.filter((m) => m.status === "finished").length;
  const nextFixture = matchList
    .filter((m) => m.status === "scheduled" && m.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0];

  // Event timelines are only meaningful once a match has started.
  const eventMap = new Map<string, Awaited<ReturnType<typeof getMatchEvents>>>();
  await Promise.all(
    matchList
      .filter((m) => m.status === "finished" || m.status === "live")
      .map(async (m) => {
        eventMap.set(m.id, await getMatchEvents(m.id));
      }),
  );

  const champion = tournament.winnerTeamId ? teamMap.get(tournament.winnerTeamId) : null;
  const assigned = roster.filter((p) => p.teamId).length;
  const goldenBoot = groupTopScorers(stats.scorers)[0] ?? [];
  // Awards only make sense after a result; otherwise every team ties on zero.
  const hasResults = stats.standings.some((row) => row.played > 0);
  const bestAttackTeams = hasResults ? bestAttackGrouped(stats.teamStats) : [];
  const bestDefenceTeams = hasResults ? bestDefenceGrouped(stats.teamStats) : [];

  const nav = [
    ...(galleryPhotos.length > 0 ? [{ id: "memories", label: "Memories" }] : []),
    { id: "fixtures", label: "Matches" },
    { id: "standings", label: "Table" },
    { id: "stats", label: "Stats" },
    { id: "squads", label: "Squads" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-3)] transition hover:text-[var(--pitch)]"
      >
        <span aria-hidden>←</span> All cups
      </Link>

      <header className="relative mt-4 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)]/70">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--pitch)] via-[var(--info)] to-[var(--trophy)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-[var(--pitch-a12)] blur-3xl"
        />
        <div className="relative p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <Stamp tone={statusTone(tournament.status)}>{statusLabel(tournament.status)}</Stamp>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--pitch)]">
              {formatLabel(tournament.format)}
            </span>
            {tournament.clubName ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-3)]">
                {tournament.clubName}
              </span>
            ) : null}
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-3)]">
              Tournament hub
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-black leading-[1.08] tracking-tight text-[var(--ink)] sm:text-5xl">
            {tournament.name}
          </h1>
          {tournament.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-2)] sm:text-base">
              {tournament.description}
            </p>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-4">
            <StatTile label="Teams" value={String(teamList.length)} />
            <StatTile label="Players" value={String(roster.length)} />
            <StatTile label="Played" value={`${finished}/${matchList.length}`} />
            <StatTile
              label="Next kickoff"
              value={nextFixture ? formatDateTime(nextFixture.scheduledAt) : "—"}
            />
          </dl>

          {champion ? (
            <div className="relative mt-4 flex items-center gap-3 overflow-hidden rounded-xl border border-[var(--trophy)]/40 bg-[var(--trophy-tint)] px-4 py-3">
              <StatusSpine tone="trophy" />
              <TeamCrest team={champion} size={38} />
              <div className="min-w-0">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--trophy)]">
                  Champions
                </h2>
                <p className="truncate font-black text-[var(--ink)]">{champion.name}</p>
              </div>
              <span aria-hidden className="ml-auto text-xl text-[var(--trophy)]">
                ★
              </span>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={`/join/${tournament.slug}`} className={buttonVariants()}>
              Register to play
            </Link>
            <a href="#fixtures" className={buttonVariants({ variant: "secondary" })}>
              Fixtures
            </a>
            {galleryPhotos.length > 0 ? (
              <a href="#memories" className={buttonVariants({ variant: "secondary" })}>
                Photos ({galleryPhotos.length})
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <nav aria-label="On this page" className="sticky top-14 z-30 mt-5 lg:top-16">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-[var(--rule)] bg-[var(--surface-a85)] p-1 backdrop-blur">
          {nav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold text-[var(--ink-3)] transition hover:bg-[var(--sunken)] hover:text-[var(--pitch)]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {galleryPhotos.length > 0 ? (
        <section id="memories" className="mt-9 scroll-mt-32">
          <SectionHeading
            title="Memories"
            eyebrow="The documentary"
            action={
              <span className="text-xs text-[var(--ink-3)]">
                {galleryPhotos.length} {galleryPhotos.length === 1 ? "photo" : "photos"} · like,
                comment, share, save
              </span>
            }
          />
          <MemoryGallery
            photos={galleryPhotos}
            tournamentId={tournament.id}
            slug={tournament.slug}
            tournamentName={tournament.name}
            initialPhotoId={initialPhotoId}
          />
        </section>
      ) : null}

      <section id="fixtures" className="mt-9 scroll-mt-32">
          <SectionHeading
            title="Match centre"
            eyebrow="Fixtures & results"
            action={
              <span className="text-xs tabular-nums text-[var(--ink-3)]">
                {finished} of {matchList.length} played
              </span>
            }
          />
          {rounds.length === 0 ? (
            <EmptyState
              title="No fixtures yet"
              hint="The organiser will publish the schedule once teams are confirmed."
            />
          ) : (
            <div className="space-y-7">
              {rounds.map(({ stage, round, matches: roundMatches }) => {
                return (
                  <MatchRail
                    key={`${stage}:${round}`}
                    title={stageLabel(stage, round, tournament.format)}
                    countLabel={`${roundMatches.length} ${roundMatches.length === 1 ? "tie" : "ties"}`}
                  >
                    {roundMatches.map((m) => (
                      <div
                        key={m.id}
                        className="w-[66%] shrink-0 snap-start sm:w-[40%] lg:w-[28.5%]"
                      >
                        <MatchCard
                          match={m}
                          teams={teamMap}
                          events={(eventMap.get(m.id) ?? []).map((e) => ({
                            ...e,
                            playerName: e.playerId
                              ? (playerMap.get(e.playerId)?.fullName ?? null)
                              : null,
                            teamName: e.teamId ? (teamMap.get(e.teamId)?.name ?? null) : null,
                          }))}
                        />
                      </div>
                    ))}
                  </MatchRail>
                );
              })}
            </div>
          )}
        </section>

        <section id="standings" className="mt-9 scroll-mt-32">
          <SectionHeading
            title="League table"
            eyebrow="Standings"
            action={
              <span className="text-xs text-[var(--ink-3)]">Full season standings</span>
            }
          />
          <Card className="overflow-hidden">
            <StandingsTable standings={stats.standings} />
          </Card>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
            3 pts for a win, 1 for a draw. Tie-break: goal difference, then goals scored.
          </p>
        </section>

      <section id="stats" className="mt-10 scroll-mt-32">
        <SectionHeading title="Season leaders" eyebrow="Statistics" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--rule)] px-4 py-3">
              <h3 className="text-sm font-bold text-[var(--ink)]">Top scorers</h3>
              <span className="text-[11px] tabular-nums text-[var(--ink-3)]">
                {stats.scorers.length} scorers
              </span>
            </div>
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
          </Card>

          <div className="space-y-3">
            {goldenBoot.length > 0 ? (
              <Card className="relative overflow-hidden border-[var(--trophy)]/40 bg-[var(--trophy-tint)] p-5">
                <StatusSpine tone="trophy" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--trophy)]">
                  {goldenBoot.length > 1 ? "Golden boot (joint)" : "Golden boot"}
                </h3>
                <p className="mt-2 text-xl font-black leading-tight text-[var(--ink)]">
                  {goldenBoot.map((s) => s.player.fullName).join(" & ")}
                </p>
                <p className="mt-1 text-sm text-[var(--ink-2)]">
                  {goldenBoot[0].goals} goals
                  {goldenBoot[0].teamName ? ` · ${goldenBoot[0].teamName}` : ""}
                </p>
              </Card>
            ) : null}
            <Card className="p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--info)]">
                Team records
              </h3>
              <dl className="mt-3 space-y-3 text-sm">
                <RecordRow
                  label={bestAttackTeams.length > 1 ? "Best attack (joint)" : "Best attack"}
                  names={bestAttackTeams.map((t) => t.team.name)}
                  value={`${bestAttackTeams[0]?.goalsScored ?? 0} ${bestAttackTeams[0]?.goalsScored === 1 ? "goal" : "goals"} scored`}
                />
                <RecordRow
                  label={bestDefenceTeams.length > 1 ? "Best defence (joint)" : "Best defence"}
                  names={bestDefenceTeams.map((t) => t.team.name)}
                  value={`${bestDefenceTeams[0]?.goalsConceded ?? 0} ${bestDefenceTeams[0]?.goalsConceded === 1 ? "goal" : "goals"} conceded`}
                />
              </dl>
            </Card>
          </div>
        </div>

      </section>

      <section id="squads" className="mt-10 scroll-mt-32">
        <SectionHeading
          title="Squads"
          eyebrow="Players"
          action={
            <span className="text-xs tabular-nums text-[var(--ink-3)]">
              {assigned}/{roster.length} assigned
            </span>
          }
        />
        {teamList.length === 0 ? (
          <EmptyState title="Teams have not been created yet" />
        ) : (
          <div className="space-y-3">
            {teamList.map((team, index) => {
              const squad = roster.filter((p) => p.teamId === team.id);
              const officials = [
                team.captainName ? `C · ${team.captainName}` : null,
                team.managerName ? `M · ${team.managerName}` : null,
              ]
                .filter(Boolean)
                .join("   ");
              return (
                <details
                  key={team.id}
                  open={index === 0}
                  className="group overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--surface)]/70"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-[var(--sunken)] [&::-webkit-details-marker]:hidden">
                    <TeamCrest team={team as Team} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--ink)]">{team.name}</p>
                      <p className="truncate text-xs text-[var(--ink-3)]">
                        {officials || "No officials named"}
                      </p>
                    </div>
                    <span className="ml-auto shrink-0 rounded-md bg-[var(--sunken)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--ink-2)]">
                      {squad.length}
                    </span>
                    <span
                      aria-hidden
                      className="text-xs text-[var(--ink-3)] transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  {squad.length === 0 ? (
                    <p className="border-t border-[var(--rule)] px-4 py-6 text-center text-sm text-[var(--ink-3)]">
                      No players assigned yet
                    </p>
                  ) : (
                    <div className="grid gap-x-6 border-t border-[var(--rule)] p-3 sm:grid-cols-2">
                      {squad.map((p) => (
                        <PlayerRow key={p.id} player={p} />
                      ))}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-3)]">
        {label}
      </dt>
      <dd className="mt-1 truncate text-lg font-black tabular-nums text-[var(--ink)] sm:text-xl">
        {value}
      </dd>
    </div>
  );
}

function RecordRow({ label, names, value }: { label: string; names: string[]; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
        {label}
      </dt>
      {/* An award can be shared, so every tied team gets its own row rather
          than being folded into one truncating "A & B" string. */}
      <dd className="mt-1.5">
        {names.length > 0 ? (
          <ul className="space-y-1.5">
            {names.map((name) => (
              <li
                key={name}
                className="flex items-baseline justify-between gap-3 font-bold text-[var(--ink)]"
              >
                <span className="min-w-0 truncate">
                  <span aria-hidden className="mr-1.5 text-[var(--info)]">
                    •
                  </span>
                  {name}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--info)]">
                  {value}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-bold text-[var(--ink-3)]">—</p>
        )}
      </dd>
    </div>
  );
}
