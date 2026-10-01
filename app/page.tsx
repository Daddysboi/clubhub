import Link from "next/link";
import {
  getStandings,
  getTournamentMatches,
  getTournamentTeams,
  listTournaments,
} from "@/lib/db/queries";
import { Card, EmptyState, SectionHeading, Stamp } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/MatchCard";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamCrest } from "@/components/TeamCrest";
import { formatDate } from "@/lib/format";
import { statusLabel, statusTone } from "@/lib/tones";
import type { Team } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const all = await listTournaments();
  const visible = all.filter((t) => t.status !== "draft");

  if (visible.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
        <EmptyState
          title="No tournaments yet"
          hint="Once the organiser publishes a tournament it appears here with teams, fixtures, scores and standings."
          action={
            <Link href="/join" className="block w-full sm:w-auto sm:inline-block">
              <Button block>Register as a player</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const featured = visible.find((t) => t.status === "live") ?? visible[0];
  const [teamList, matchList, standings] = await Promise.all([
    getTournamentTeams(featured.id),
    getTournamentMatches(featured.id),
    getStandings(featured.id),
  ]);
  const teamMap = new Map(teamList.map((t) => [t.id, t as Team]));

  const upcoming = matchList.filter((m) => m.status === "scheduled");
  const finished = matchList.filter((m) => m.status === "finished");
  const live = matchList.filter((m) => m.status === "live");
  const leader = standings[0];
  const leaderInPlay = leader && leader.played > 0;
  // statusTone()/statusLabel() own the status→tone mapping. Inlining a ternary
  // here is how the hero badge and the tournament cards drifted apart before.
  const featuredLive = featured.status === "live";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-xl border border-[var(--rule)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--pitch)]/15 p-6 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <Stamp tone={statusTone(featured.status)}>
            {featuredLive ? (
              <>
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--live)]" />
                Live now
              </>
            ) : (
              statusLabel(featured.status)
            )}
          </Stamp>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-[var(--ink)] sm:text-5xl">
            {featured.name}
          </h1>

          {featured.description ? (
            <p className="mt-3 text-base leading-relaxed text-[var(--ink-2)]">
              {featured.description}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[var(--ink-3)]">
            {featured.venue ? <span>{featured.venue}</span> : null}
            {featured.startDate ? <span>{formatDate(featured.startDate)}</span> : null}
            <span>
              {teamList.length} {teamList.length === 1 ? "team" : "teams"}
            </span>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={`/tournaments/${featured.slug}`} className="block">
              <Button block>View competition</Button>
            </Link>
            <Link href={`/join/${featured.slug}`} className="block">
              <Button block variant="secondary">Register to play</Button>
            </Link>
          </div>
        </div>

        {leaderInPlay ? (
          <div className="relative z-10 mt-8 inline-flex items-center gap-3 rounded-lg border border-[var(--pitch)]/40 bg-[var(--pitch-a12)] px-4 py-3">
            <TeamCrest team={leader!.team} size={36} />
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[var(--pitch)]">Leading</p>
              <p className="font-bold text-[var(--ink)]">
                {leader!.team.name} · {leader!.points} pts
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {live.length > 0 ? (
        <section className="mt-10">
          <SectionHeading title="Live now" eyebrow="In play" />
          <div className="grid gap-4 sm:grid-cols-2">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} teams={teamMap} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading
          title="Upcoming fixtures"
          eyebrow="Schedule"
          action={
            <Link
              href={`/tournaments/${featured.slug}`}
              className="text-sm font-semibold text-[var(--pitch)] hover:underline"
            >
              All fixtures
            </Link>
          }
        />
        {upcoming.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-[var(--ink-3)] ruling">
            No upcoming fixtures scheduled.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.slice(0, 6).map((m) => (
              <MatchCard key={m.id} match={m} teams={teamMap} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title="Recent results" eyebrow="Results" />
          <Card className="overflow-hidden">
            {finished.length === 0 ? (
              <p className="ruling px-4 py-10 text-center text-sm text-[var(--ink-3)]">
                No results yet. Scores appear here once games finish.
              </p>
            ) : (
              [...finished]
                .reverse()
                .slice(0, 6)
                .map((m) => {
                  const home = teamMap.get(m.homeTeamId);
                  const away = teamMap.get(m.awayTeamId);
                  if (!home || !away) return null;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 border-b border-[var(--rule)] px-4 py-3 last:border-0"
                    >
                      <TeamCrest team={home} size={26} />
                      <span className="flex-1 truncate text-right text-sm font-semibold text-[var(--ink)]">
                        {home.name}
                      </span>
                      <span className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-sm font-black tabular-nums text-[var(--ink)]">
                        {m.homeScore} – {m.awayScore}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold text-[var(--ink)]">
                        {away.name}
                      </span>
                      <TeamCrest team={away} size={26} />
                    </div>
                  );
                })
            )}
          </Card>
        </section>

        <section>
          <SectionHeading title="Standings" eyebrow="Table" />
          <Card className="overflow-hidden">
            <StandingsTable standings={standings} />
          </Card>
        </section>
      </div>

      {visible.length > 1 ? (
        <section className="mt-12">
          <SectionHeading title="More tournaments" eyebrow="Archive" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.slice(1).map((t) => (
              <Link key={t.id} href={`/tournaments/${t.slug}`}>
                <Card className="h-full p-5 transition hover:border-[var(--pitch)]/50">
                  <Stamp tone={statusTone(t.status)}>
                    {statusLabel(t.status)}
                  </Stamp>
                  <h3 className="mt-3 font-bold text-[var(--ink)]">{t.name}</h3>
                  <p className="mt-1 text-xs text-[var(--ink-3)]">
                    {t.venue ? `${t.venue} · ` : ""}
                    {t.startDate ? formatDate(t.startDate) : "Date TBC"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}