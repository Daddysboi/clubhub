import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/db/queries";
import { SignupForm } from "@/components/SignupForm";
import { Card, SectionHeading } from "@/components/ui/card";
import { signupPlayer } from "@/app/actions/players";
import { PlayerRow } from "@/components/PlayerRow";
import { getPlayersForTournament } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function JoinTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const roster = await getPlayersForTournament(tournament.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        href={`/tournaments/${tournament.slug}`}
        className="text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)]"
      >
        ← {tournament.name}
      </Link>

      <div className="mt-4">
        <SectionHeading title="Register to play" eyebrow={tournament.name} />
      </div>

      <SignupForm
        action={signupPlayer}
        tournamentId={tournament.id}
        tournamentName={tournament.name}
      />

      <section className="mt-10">
        <SectionHeading
          title="Registered players"
          eyebrow={`${roster.length} signed up`}
        />
        <Card className="overflow-hidden">
          {roster.length === 0 ? (
            <p className="ruling px-4 py-8 text-center text-sm text-[var(--ink-3)]">
              Be the first to register.
            </p>
          ) : (
            roster.map((p) => <PlayerRow key={p.id} player={p} />)
          )}
        </Card>
        <p className="mt-2 text-xs text-[var(--ink-3)]">
          Names and nicknames only — phone numbers are never shown publicly.
        </p>
      </section>
    </div>
  );
}