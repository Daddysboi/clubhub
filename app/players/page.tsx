import Link from "next/link";
import { getPublicPlayers, listTournaments, searchPlayers } from "@/lib/db/queries";
import { Card, EmptyState, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerRow } from "@/components/PlayerRow";
import { PlayersFilters } from "@/components/PlayersFilters";

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

      <PlayersFilters
        tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
        query={query}
        scope={scope}
      />

      <Card className="overflow-hidden">
        {players.length === 0 ? (
          <EmptyState
            title={query ? "No players match that search" : "No squad players yet"}
            hint={
              query
                ? "Try a different name."
                : scope
                  ? "This competition has no squad players yet."
                  : "Players appear here once an organiser adds them to a squad."
            }
            action={
              <Link href="/join" className="block w-full sm:w-auto sm:inline-block">
                <Button block>Join a competition</Button>
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