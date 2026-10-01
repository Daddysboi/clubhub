import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/db/auth";
import {
  getTournamentById,
  getTournamentMatches,
  getTournamentTeams,
  getPlayersForTournament,
  getStandings,
  getTournamentEvents,
  getTournamentStats,
} from "@/lib/db/queries";
import { AdminPlayers } from "@/components/admin/AdminPlayers";
import { AdminTeams } from "@/components/admin/AdminTeams";
import { AdminFixtures } from "@/components/admin/AdminFixtures";
import { AdminTournamentSettings } from "@/components/admin/AdminTournamentSettings";
import { AdminLiveStats } from "@/components/admin/AdminLiveStats";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { SignOutButton } from "@/components/SignOutButton";
import { statusLabel, statusTone } from "@/lib/tones";
import { Card, Stamp } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Organiser-only: this page exposes rosters and contact details.
  const admin = await getCurrentAdmin();
  if (!admin) redirect(`/admin?next=${encodeURIComponent(`/admin/tournaments/${(await params).id}`)}`);

  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const [teams, matches, players, standings, eventRows, stats] = await Promise.all([
    getTournamentTeams(tournament.id),
    getTournamentMatches(tournament.id),
    getPlayersForTournament(tournament.id),
    getStandings(tournament.id),
    getTournamentEvents(tournament.id),
    getTournamentStats(tournament.id),
  ]);

  // Group events by match so each fixture card can render its own timeline.
  const eventsByMatch: Record<string, typeof eventRows> = {};
  for (const e of eventRows) {
    (eventsByMatch[e.matchId] ??= []).push(e);
  }

  const unassigned = players.filter((p) => !p.teamId).length;
  const liveMatches = matches.filter((m) => m.status === "live").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm text-[var(--ink-3)] hover:text-[var(--ink)]">
            ← All tournaments
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[var(--ink-3)] sm:inline">{admin.email}</span>
            <SignOutButton />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
            {tournament.name}
          </h1>
          <Stamp tone={statusTone(tournament.status)}>{statusLabel(tournament.status)}</Stamp>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Teams", value: teams.length },
            { label: "Players", value: players.length },
            { label: "Unassigned", value: unassigned },
            { label: "Fixtures", value: matches.length },
          ].map((s) => (
            <Card key={s.label} className="px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)]">
                {s.label}
              </dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--ink)]">
                {s.value}
              </dd>
            </Card>
          ))}
        </dl>
      </header>

      <AdminTabs
        initial="teams"
        tabs={[
          {
            id: "teams",
            label: "Teams",
            badge: teams.length,
            content: <AdminTeams tournament={tournament} teams={teams} players={players} />,
          },
          {
            id: "fixtures",
            label: "Fixtures",
            badge: matches.length,
            content: <AdminFixtures tournament={tournament} teams={teams} matches={matches} />,
          },
          {
            id: "players",
            label: "Players",
            badge: players.length,
            content: (
              <AdminPlayers tournamentId={tournament.id} players={players} teams={teams} />
            ),
          },
          {
            id: "live",
            label: "Live",
            badge: liveMatches,
            content: (
              <AdminLiveStats
                tournamentName={tournament.name}
                teams={teams}
                matches={matches}
                standings={standings}
                players={players}
                scorers={stats.scorers}
                events={eventsByMatch}
              />
            ),
          },
          {
            id: "settings",
            label: "Settings",
            content: <AdminTournamentSettings tournament={tournament} teams={teams} />,
          },
        ]}
      />
    </div>
  );
}