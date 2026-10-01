import Link from "next/link";
import { listTournaments } from "@/lib/db/queries";
import { SignupForm } from "@/components/SignupForm";
import { Card, SectionHeading } from "@/components/ui/card";
import { signupPlayer } from "@/app/actions/players";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const all = await listTournaments();
  const open = all.filter((t) => t.status === "live" || t.status === "draft");

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <SectionHeading title="Register to play" eyebrow="Player signup" />

      {open.length > 1 ? (
        <Card className="mb-6 p-5">
          <p className="font-semibold text-[var(--ink)]">Choose a competition</p>
          <div className="mt-3 space-y-2">
            {open.map((t) => (
              <Link
                key={t.id}
                href={`/join/${t.slug}`}
                className="flex items-center justify-between rounded-lg border border-[var(--rule-strong)] px-3 py-2.5 text-sm transition hover:border-[var(--pitch)]"
              >
                <span className="font-medium text-[var(--ink)]">{t.name}</span>
                <span className="text-xs text-[var(--ink-3)]">Join →</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {open.length === 1 ? (
        <p className="mb-6 text-sm text-[var(--ink-3)]">
          Registering for <span className="font-semibold text-[var(--ink-2)]">{open[0].name}</span>.
          Change your entry afterwards by asking the organiser.
        </p>
      ) : null}

      <SignupForm
        action={signupPlayer}
        tournamentId={open.length === 1 ? open[0].id : ""}
        tournamentName={open.length === 1 ? open[0].name : undefined}
      />

      <p className="mt-6 text-center text-sm text-[var(--ink-3)]">
        Not part of a tournament?{" "}
        <Link
          href="/players"
          className="inline-flex min-h-11 items-center font-medium text-[var(--pitch)] hover:underline"
        >
          View the players list
        </Link>
      </p>
    </div>
  );
}