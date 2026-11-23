import Image from "next/image";
import type { Match, MatchEvent, Team } from "@/lib/db/schema";
import { TeamCrest } from "@/components/TeamCrest";
import { Stamp } from "@/components/ui/card";
import { formatDateTime, relativeKickoff } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/tones";

export type MatchEventRow = MatchEvent & { playerName: string | null; teamName: string | null };

export function matchTone(match: Match): Tone {
  if (match.status === "live") return "live";
  if (match.status === "finished") return "pitch";
  return "warn";
}

export function MatchCard({
  match,
  teams,
  events = [],
}: {
  match: Match;
  teams: Map<string, Team>;
  events?: MatchEventRow[];
}) {
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  if (!home || !away) return null;

  const played = match.status === "finished" || match.status === "live";
  const soon = relativeKickoff(match.scheduledAt);
  // matchTone() already centralises this mapping; inlining it here is what let
  // the bar and the badge drift apart.
  const tone = matchTone(match);
  const isLive = match.status === "live";
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const statusText = isLive ? "live" : match.status === "finished" ? "full time" : "scheduled";

  // Scorers sit under the team they played for, inside the scoreline itself —
  // no second timeline block underneath the card.
  const homeEvents = events.filter(
    (event) => event.teamId === home.id || event.teamName === home.name,
  );
  const awayEvents = events.filter(
    (event) => event.teamId === away.id || event.teamName === away.name,
  );
  const otherEvents = events.filter(
    (event) => !homeEvents.includes(event) && !awayEvents.includes(event),
  );

  return (
    <article
      aria-label={`${home.name} versus ${away.name}, ${statusText}`}
      className="relative overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--surface)]/70"
    >
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

      <header className="flex items-center justify-between gap-2 border-b border-[var(--rule)] px-3 py-2">
        <span className="min-w-0 truncate text-[11px] text-[var(--ink-3)]">
          {match.venue ?? "Match"}
        </span>
        {isLive ? (
          <Stamp tone={tone} className="shrink-0 whitespace-nowrap px-1.5 text-[10px]">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--live)]" />
            LIVE
          </Stamp>
        ) : played ? (
          <Stamp tone={tone} className="shrink-0 whitespace-nowrap px-1.5 text-[10px]">
            <abbr title="Full time" className="no-underline">
              FT
            </abbr>
          </Stamp>
        ) : (
          <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-[var(--ink-3)]">
            {soon ?? formatDateTime(match.scheduledAt)}
          </span>
        )}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 px-4 py-4">
        <div className="min-w-0">
          <Side team={home} align="right" score={match.homeScore} show={played} />
          <ScorerList events={homeEvents} align="right" />
        </div>

        <div className="flex flex-col items-center pt-0.5">
          {hasScore ? (
            <span className="text-2xl font-black tabular-nums text-[var(--ink)]">
              {match.homeScore}–{match.awayScore}
            </span>
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--ink-3)]">
              vs
            </span>
          )}
          {!played && match.scheduledAt ? (
            <span className="mt-1 text-center text-[11px] leading-tight text-[var(--ink-3)]">
              {formatDateTime(match.scheduledAt)}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <Side team={away} align="left" score={match.awayScore} show={played} />
          <ScorerList events={awayEvents} align="left" />
        </div>
      </div>

      {otherEvents.length > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--rule)] px-4 py-2">
          {otherEvents.map((event) => (
            <li key={event.id} className="flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
              <EventMark type={event.type} />
              <span>{event.playerName ?? "Unknown"}</span>
            </li>
          ))}
        </ul>
      ) : null}

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
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" ? "flex-row-reverse text-right" : "text-left",
      )}
    >
      <TeamCrest team={team} size={40} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">{team.name}</p>
        {show ? (
          <p className="text-lg font-black tabular-nums text-[var(--ink-2)]">{score ?? "—"}</p>
        ) : (
          <p className="text-xs text-[var(--ink-3)]">—</p>
        )}
      </div>
    </div>
  );
}

function ScorerList({ events, align }: { events: MatchEventRow[]; align: "left" | "right" }) {
  if (events.length === 0) return null;
  return (
    <ul className={cn("mt-2 space-y-1", align === "right" ? "text-right" : "text-left")}>
      {events.map((event) => (
        <li
          key={event.id}
          className={cn(
            "flex items-baseline gap-1 text-[11px] leading-tight",
            align === "right" && "flex-row-reverse",
          )}
        >
          <span className="shrink-0 tabular-nums text-[var(--ink-3)]">
            {event.minute !== null ? `${event.minute}′` : "—"}
          </span>
          <span className="min-w-0 truncate text-[var(--ink-2)]">
            {event.playerName ?? "Unknown"}
          </span>
          <EventMark type={event.type} />
        </li>
      ))}
    </ul>
  );
}

function EventMark({ type }: { type: string }) {
  if (type === "yellow_card" || type === "second_yellow") {
    return (
      <span
        role="img"
        aria-label="Yellow card"
        className="size-1.5 shrink-0 rounded-full bg-[var(--warn)]"
      />
    );
  }
  if (type === "red_card") {
    return (
      <span
        role="img"
        aria-label="Red card"
        className="size-1.5 shrink-0 rounded-full bg-[var(--live)]"
      />
    );
  }
  return (
    <span role="img" aria-label="Goal" title="Goal" className="shrink-0 text-[var(--pitch)]">
      ●
    </span>
  );
}
