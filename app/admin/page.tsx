import Link from "next/link";
import { getCurrentAdmin } from "@/lib/db/auth";
import { AdminLogin } from "@/components/AdminLogin";
import { SignOutButton } from "@/components/SignOutButton";
import { NewTournamentForm } from "@/components/admin/NewTournamentForm";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { listTournaments, getTournamentTeams, getTournamentMatches, getPlayersForTournament } from "@/lib/db/queries";
import { EmptyState, SectionHeading, Stamp } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { statusLabel, statusTone } from "@/lib/tones";
import { AdminDeleteTournament } from "@/components/admin/AdminDeleteTournament";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    // Preserve where the user was headed so the form can return them there.
    const { next } = await searchParams;
    return <AdminLogin next={next} />;
  }

  const tournaments = await listTournaments();
  const stats = await Promise.all(
    tournaments.map(async (t) => {
      const [teams, matches, players] = await Promise.all([
        getTournamentTeams(t.id),
        getTournamentMatches(t.id),
        getPlayersForTournament(t.id),
      ]);
      return { tournament: t, teamCount: teams.length, matchCount: matches.length, playerCount: players.length };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdminTabs
        initial="tournaments"
        leading={
          <p className="shrink-0 text-sm text-[var(--ink-3)]">Organiser panel</p>
        }
        trailing={
          <div className="flex items-center gap-3">
            <span className="max-w-[14rem] truncate text-xs text-[var(--ink-3)] sm:max-w-none">
              {admin.email}
            </span>
            <SignOutButton />
          </div>
        }
        tabs={[
          {
            id: "tournaments",
            label: "Your tournaments",
            hint: "Everything you run",
            badge: tournaments.length,
            content: (
              <section>
                <SectionHeading title="Your tournaments" eyebrow="Manage" />
                {tournaments.length === 0 ? (
                  <EmptyState
                    title="No tournaments yet"
                    hint="Create your first competition from the Create tab."
                  />
                ) : (
                  <TournamentTable stats={stats} />
                )}
              </section>
            ),
          },
          {
            id: "create",
            label: "Create",
            hint: "Start a new competition",
            content: (
              <section>
                <SectionHeading title="New tournament" eyebrow="Create" />
                <NewTournamentForm />
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}

type Stat = {
  tournament: { id: string; name: string; slug: string; status: string; startDate: string | null };
  teamCount: number;
  matchCount: number;
  playerCount: number;
};

/**
 * Tournament overview as a table rather than cards.
 *
 * A card grid needs a second glance to compare two competitions; a row reads
 * left to right, so status and counts line up across every entry. The name is
 * the link, and the whole row is clickable for a comfortable target on mobile.
 * On small screens the count columns collapse into a single summary line so the
 * table never needs horizontal scrolling.
 */
function TournamentTable({ stats }: { stats: Stat[] }) {
  return (
    <>
      {/* Desktop / tablet: the real table. */}
      <div className="hidden overflow-hidden rounded-xl border border-[var(--rule)] sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--rule)] bg-[var(--surface)]/50 text-left text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              <th scope="col" className="px-4 py-3 font-semibold">Tournament</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Date</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Teams</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Players</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Fixtures</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ tournament: t, teamCount, matchCount, playerCount }) => (
              <tr
                key={t.id}
                className="border-b border-[var(--rule)] transition last:border-b-0 hover:bg-[var(--pitch-a8)]"
              >
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  <Link
                    href={`/admin/tournaments/${t.id}`}
                    className="rounded text-[var(--ink)] underline decoration-dotted underline-offset-4 hover:text-[var(--pitch)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pitch)]/50"
                  >
                    {t.name}
                  </Link>
                  <span className="mt-0.5 block text-xs font-normal text-[var(--ink-3)]">
                    /{t.slug}
                  </span>
                </th>
                <td className="px-4 py-3">
                  <Stamp tone={statusTone(t.status)}>{statusLabel(t.status)}</Stamp>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">
                  {t.startDate ? formatDate(t.startDate) : "No date"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-2)]">{teamCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-2)]">{playerCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-2)]">{matchCount}</td>
                <td className="px-4 py-3 text-right">
                  <AdminDeleteTournament
                    tournamentId={t.id}
                    name={t.name}
                    teamCount={teamCount}
                    playerCount={playerCount}
                    matchCount={matchCount}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one stacked card per tournament. The link covers the text and the
          delete button sits beside it, because nesting a button inside an anchor is
          invalid HTML and the tap target would fight the navigation. */}
      <ul className="space-y-3 sm:hidden">
        {stats.map(({ tournament: t, teamCount, matchCount, playerCount }) => (
          <li
            key={t.id}
            className="flex items-stretch gap-2 rounded-xl border border-[var(--rule)] bg-[var(--surface)]/70 p-4"
          >
            <Link
              href={`/admin/tournaments/${t.id}`}
              className="min-w-0 flex-1 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pitch)]/50"
            >
              <Stamp tone={statusTone(t.status)}>{statusLabel(t.status)}</Stamp>
              <span className="mt-2 block font-semibold text-[var(--ink)]">{t.name}</span>
              <span className="mt-0.5 block text-xs text-[var(--ink-3)]">
                {t.startDate ? formatDate(t.startDate) : "No date"} · /{t.slug}
              </span>
              <span className="mt-2 block text-sm text-[var(--ink-2)]">
                {teamCount} teams · {playerCount} players · {matchCount} fixtures
              </span>
            </Link>
            <div className="flex shrink-0 items-start">
              <AdminDeleteTournament
                tournamentId={t.id}
                name={t.name}
                teamCount={teamCount}
                playerCount={playerCount}
                matchCount={matchCount}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}