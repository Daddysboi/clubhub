import Link from "next/link";
import { getPublicPlayers, listTournaments, searchPlayers } from "@/lib/db/queries";
import { Card, EmptyState, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerRow } from "@/components/PlayerRow";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const scope = typeof params.tournament === "string" && params.tournament ? params.tournament : undefined;

  const tournaments = (await listTournaments()).filter((t) => t.status !== "draft");

  const rows = query ? await searchPlayers(query) : await getPublicPlayers(scope);
  const players = scope ? rows.filter((p) => p.tournamentId === scope) : rows;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <SectionHeading title="Players" eyebrow={`${players.length} registered`} />

      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name…"
          aria-label="Search players"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--rule-strong)] bg-[var(--paper)] px-3 py-2.5 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--pitch)] focus:ring-2 focus:ring-[var(--pitch)]/30"
        />
        <select
          name="tournament"
          defaultValue={scope ?? ""}
          aria-label="Filter by tournament"
          className="min-h-11 rounded-lg border border-[var(--rule-strong)] bg-[var(--paper)] px-3 py-2.5 text-base text-[var(--ink)] outline-none focus:border-[var(--pitch)]"
        >
          <option value="">All competitions</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card className="overflow-hidden">
        {players.length === 0 ? (
          <EmptyState
            title={query ? "No players match that search" : "No players yet"}
            hint={
              query
                ? "Try a different name."
                : "Players appear here as soon as they register."
            }
            action={
              <Link href="/join" className="block w-full sm:w-auto sm:inline-block">
                <Button block>Register now</Button>
              </Link>
            }
          />
        ) : (
          players.map((p) => <PlayerRow key={`${p.id}-${p.teamId ?? "none"}`} player={p} />)
        )}
      </Card>
    </div>
  );
}