import Link from "next/link";
import { getMemoryCountsByTournament, listTournaments } from "@/lib/db/queries";
import { Card, EmptyState, Stamp, StatusSpine } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { statusLabel, statusTone, toneClasses } from "@/lib/tones";
import type { Tournament } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const [all, memoryCounts] = await Promise.all([
    listTournaments(),
    getMemoryCountsByTournament(),
  ]);
  const visible = all.filter((t) => t.status !== "draft");
  const live = visible.filter((t) => t.status === "live");
  const archived = visible.filter((t) => t.status !== "live");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:pt-10">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)]">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--pitch)] via-[var(--info)] to-[var(--trophy)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-[var(--info-tint)] blur-3xl"
        />
        <div className="relative p-6 sm:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--pitch)]">
            Competitions
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[var(--ink)] sm:text-5xl">
            Cups
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--ink-2)]">
            Every tournament, table and match-day memory — all in one place.
          </p>

          <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-[var(--rule)] pt-6">
            <Metric label="Published" value={visible.length} />
            <Metric label="Live now" value={live.length} tone="text-[var(--pitch)]" />
            <Metric label="Completed" value={archived.length} />
          </dl>
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No tournaments published yet"
            hint="Check back soon — the organiser will publish the competition here."
          />
        </div>
      ) : (
        <>
          {live.length > 0 ? (
            <section className="mt-10" aria-labelledby="live-cups-heading">
              <div className="mb-4 flex items-center gap-3">
                <h2 id="live-cups-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
                  Live now
                </h2>
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--live)]" aria-hidden />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {live.map((tournament) => (
                  <FeaturedCup
                    key={tournament.id}
                    tournament={tournament}
                    photoCount={memoryCounts[tournament.id] ?? 0}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {archived.length > 0 ? (
            <section className="mt-10">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">All cups</h2>
                <span className="text-xs text-[var(--ink-3)]">
                  {archived.length} {archived.length === 1 ? "competition" : "competitions"}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((tournament) => (
                  <CupCard
                    key={tournament.id}
                    tournament={tournament}
                    photoCount={memoryCounts[tournament.id] ?? 0}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-3)]">
        {label}
      </dt>
      <dd className={`mt-1 text-2xl font-black tabular-nums ${tone ?? "text-[var(--ink)]"}`}>
        {value}
      </dd>
    </div>
  );
}

function FeaturedCup({
  tournament,
  photoCount,
}: {
  tournament: Tournament;
  photoCount: number;
}) {
  return (
    <Card className="relative overflow-hidden p-6 sm:p-7">
      <StatusSpine tone="pitch" />
      <div className="flex flex-wrap items-center gap-3">
        <Stamp tone={statusTone(tournament.status)}>{statusLabel(tournament.status)}</Stamp>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-3)]">
          In progress
        </span>
      </div>
      <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight text-[var(--ink)]">
        {tournament.name}
      </h3>
      {tournament.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--ink-2)]">
          {tournament.description}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--ink-3)]">
        {tournament.venue ? <span>{tournament.venue}</span> : null}
        {tournament.startDate ? <span>Started {formatDate(tournament.startDate)}</span> : null}
      </div>
      {photoCount > 0 ? (
        <Link
          href={`/tournaments/${tournament.slug}#memories`}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--info-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--info)] transition hover:bg-[var(--sunken)]"
        >
          <span aria-hidden>▣</span>
          {photoCount} {photoCount === 1 ? "photo" : "photos"} — view album
        </Link>
      ) : null}
      <div className="mt-6">
        <Link href={`/tournaments/${tournament.slug}`}>
          <Button size="md">Follow the cup →</Button>
        </Link>
      </div>
    </Card>
  );
}

function CupCard({
  tournament,
  photoCount,
}: {
  tournament: Tournament;
  photoCount: number;
}) {
  return (
    <Link href={`/tournaments/${tournament.slug}`} className="group h-full">
      <Card className="relative flex h-full flex-col overflow-hidden p-6 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--pitch)]/60">
        <span
          aria-hidden
          className={`absolute inset-x-0 top-0 h-0.5 ${toneClasses(statusTone(tournament.status), "accent")}`}
        />
        <div className="flex items-center justify-between gap-2">
          <Stamp tone={statusTone(tournament.status)}>{statusLabel(tournament.status)}</Stamp>
          <span aria-hidden className="text-lg leading-none text-[var(--rule-strong)] transition group-hover:text-[var(--pitch)]">
            ↗
          </span>
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug tracking-tight text-[var(--ink)]">
          {tournament.name}
        </h3>
        {tournament.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--ink-3)]">
            {tournament.description}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-5 text-xs text-[var(--ink-3)]">
          {photoCount > 0 ? (
            <span className="font-semibold text-[var(--info)]">
              {photoCount} {photoCount === 1 ? "photo" : "photos"}
            </span>
          ) : null}
          {tournament.venue ? <span className="truncate">{tournament.venue}</span> : null}
          {tournament.startDate ? <span>{formatDate(tournament.startDate)}</span> : null}
        </div>
      </Card>
    </Link>
  );
}
