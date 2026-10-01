import Link from "next/link";
import { listTournaments } from "@/lib/db/queries";
import { Card, EmptyState, SectionHeading, Stamp } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { statusLabel, statusTone } from "@/lib/tones";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const all = await listTournaments();
  const visible = all.filter((t) => t.status !== "draft");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading title="Tournaments" eyebrow="Competitions" />
      {visible.length === 0 ? (
        <EmptyState
          title="No tournaments published yet"
          hint="Check back soon — the organiser will publish the competition here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.slug}`}>
              <Card className="flex h-full flex-col p-6 transition hover:border-[var(--pitch)]/50">
                <Stamp tone={statusTone(t.status)}>{statusLabel(t.status)}</Stamp>
                <h3 className="mt-3 text-lg font-bold text-[var(--ink)]">{t.name}</h3>
                {t.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--ink-3)]">{t.description}</p>
                ) : null}
                <p className="mt-auto pt-4 text-xs text-[var(--ink-3)]">
                  {t.venue ? `${t.venue}` : ""}
                  {t.startDate ? ` · ${formatDate(t.startDate)}` : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}