import Image from "next/image";
import type { Match, Team } from "@/lib/db/schema";
import { TeamCrest } from "@/components/TeamCrest";
import { Stamp } from "@/components/ui/card";
import { formatDateTime, relativeKickoff } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/tones";

export function matchTone(match: Match): Tone {
  if (match.status === "live") return "live";
  if (match.status === "finished") return "pitch";
  return "warn";
}

export function MatchCard({ match, teams }: { match: Match; teams: Map<string, Team> }) {
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  if (!home || !away) return null;

  const played = match.status === "finished" || match.status === "live";
  const soon = relativeKickoff(match.scheduledAt);
  // matchTone() already centralises this mapping; inlining it here is what let
  // the bar and the badge drift apart.
  const tone = matchTone(match);
  const isLive = match.status === "live";

  return (
    <article className="relative overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--surface)]/70">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          tone === "live"
            ? "bg-[var(--live)]"
            : tone === "pitch"
              ? "bg-[var(--pitch)]"
              : "bg-[var(--warn)]",
        )}
      />

      <header className="flex items-center justify-between border-b border-[var(--rule)] px-4 py-2">
        <span className="truncate text-xs text-[var(--ink-3)]">
          Round {match.round}
          {match.venue ? ` · ${match.venue}` : ""}
        </span>
        {isLive ? (
          <Stamp tone={tone}>
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--live)]" />
            LIVE
          </Stamp>
        ) : played ? (
          <Stamp tone={tone}>Full time</Stamp>
        ) : (
          <span className="shrink-0 text-xs font-medium text-[var(--ink-3)]">
            {soon ?? formatDateTime(match.scheduledAt)}
          </span>
        )}
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-5">
        <Side team={home} align="right" score={match.homeScore} show={played} />

        <div className="flex flex-col items-center px-1">
          {played ? (
            <span className="text-2xl font-black tabular-nums text-[var(--ink)]">
              {match.homeScore ?? 0}–{match.awayScore ?? 0}
            </span>
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--ink-3)]">vs</span>
          )}
          {!played && match.scheduledAt ? (
            <span className="mt-1 text-center text-[11px] leading-tight text-[var(--ink-3)]">
              {formatDateTime(match.scheduledAt)}
            </span>
          ) : null}
        </div>

        <Side team={away} align="left" score={match.awayScore} show={played} />
      </div>

      {match.photoUrl ? (
        <div className="relative h-44 w-full border-t border-[var(--rule)]">
          <Image
            src={match.photoUrl}
            alt={`${home.name} versus ${away.name}`}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
          />
        </div>
      ) : null}

      {match.notes && played ? (
        <p className="border-t border-[var(--rule)] px-4 py-2.5 text-xs text-[var(--ink-3)]">
          {match.notes}
        </p>
      ) : null}
    </article>
  );
}

function Side({
  team,
  align,
  score,
  show,
}: {
  team: Team;
  align: "left" | "right";
  score: number | null;
  show: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      <TeamCrest team={team} size={40} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">{team.name}</p>
        {show ? (
          <p className="text-lg font-black tabular-nums text-[var(--ink-2)]">{score ?? 0}</p>
        ) : (
          <p className="text-xs text-[var(--ink-3)]">—</p>
        )}
      </div>
    </div>
  );
}