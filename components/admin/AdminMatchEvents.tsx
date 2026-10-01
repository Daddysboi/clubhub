"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Stamp } from "@/components/ui/card";
import { addMatchEvent, deleteMatchEventForm } from "@/app/actions/events";
import { EVENT_TONE, EVENT_LABEL } from "@/lib/stats";
import { EVENT_TYPES, type MatchEvent, type Match, type Team } from "@/lib/db/schema";

type PlayerLite = {
  id: string;
  fullName: string;
  nickname: string | null;
  teamId: string | null;
};

export type EventView = MatchEvent & {
  playerName: string | null;
  teamName: string | null;
};

/** Events an admin can record in one click. Assists are intentionally excluded. */
const RECORDABLE = EVENT_TYPES.filter((t) => t !== "assist");

/**
 * Records goals, cards and substitutions for a single match.
 * Assists are deliberately not captured — the organiser wants goals and
 * cards, not an assist leaderboard.
 */
export function AdminMatchEvents({
  match,
  teams,
  players,
  events,
  readOnly = false,
}: {
  match: Match;
  teams: Team[];
  players: PlayerLite[];
  events: EventView[];
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(addMatchEvent, { ok: false });
  const [playerId, setPlayerId] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Only players actually assigned to one of these two sides can be recorded.
  // Deriving the team from the player stops the two fields disagreeing.
  const eligible = players.filter(
    (p) => p.teamId === match.homeTeamId || p.teamId === match.awayTeamId,
  );
  const player = eligible.find((p) => p.id === playerId);
  const teamId = player?.teamId ?? "";
  const matchLabel = `${teams.find((t) => t.id === match.homeTeamId)?.name ?? "?"} vs ${
    teams.find((t) => t.id === match.awayTeamId)?.name ?? "?"
  }`;

  if (readOnly) {
    return <EventTimeline events={events} />;
  }

  // `idPrefix` keeps the two render paths from emitting duplicate element
  // ids — only one is mounted at a time, but the sheet unmounts on close.
  const form = (idPrefix: string) => (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="teamId" value={teamId} />

      <Field label="Player" htmlFor={`${idPrefix}-player`} required>
        <Select
          id={`${idPrefix}-player`}
          name="playerId"
          required
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
        >
          <option value="">Choose…</option>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.nickname ? ` (${p.nickname})` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Event" htmlFor={`${idPrefix}-type`} required>
        <Select id={`${idPrefix}-type`} name="type" defaultValue="goal" disabled={!playerId}>
          {RECORDABLE.map((t) => (
            <option key={t} value={t}>
              {EVENT_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Minute" htmlFor={`${idPrefix}-minute`} hint="Leave blank if unknown">
        <Input
          id={`${idPrefix}-minute`}
          name="minute"
          inputMode="numeric"
          placeholder="e.g. 34"
        />
      </Field>

      <Field label="Note" htmlFor={`${idPrefix}-note`}>
        <Input id={`${idPrefix}-note`} name="note" placeholder="Optional" />
      </Field>

      {state.message ? (
        <div className="sm:col-span-2">
          <Stamp tone={state.ok ? "pitch" : "live"}>{state.message}</Stamp>
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <RecordButton disabled={!playerId} />
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      {/* Mobile: the 4-field form collapses into a sheet so it stops
          pushing the event timeline below the fold. */}
      <div className="sm:hidden">
        <Button block variant="secondary" onClick={() => setSheetOpen(true)}>
          Record an event
        </Button>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Record an event"
          description={matchLabel}
          footer={
            <div className="flex justify-end">
              <Button onClick={() => setSheetOpen(false)}>Done</Button>
            </div>
          }
        >
          {form(`sheet-${match.id}`)}
        </Sheet>
      </div>

      <div className="hidden sm:block">
        <Card className="p-4">
          <h4 className="font-bold text-[var(--ink)]">Record an event</h4>
          <div className="mt-3">{form(`inline-${match.id}`)}</div>
        </Card>
      </div>

      <EventTimeline events={events} editable />
    </div>
  );
}

function EventTimeline({ events, editable = false }: { events: EventView[]; editable?: boolean }) {
  if (events.length === 0) {
    return (
      <p className="ruling rounded-xl border border-[var(--rule)] px-4 py-6 text-center text-sm text-[var(--ink-3)]">
        No events recorded for this match.
      </p>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-[var(--rule)]">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-9 shrink-0 text-center font-mono text-xs text-[var(--ink-3)]">
              {e.minute !== null ? `${e.minute}′` : "—"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
              {e.playerName ?? "Unknown player"}
            </span>
            <span className="hidden shrink-0 text-xs text-[var(--ink-3)] sm:inline">
              {e.teamName ?? ""}
            </span>
            <Stamp tone={EVENT_TONE[e.type as keyof typeof EVENT_TONE] ?? "neutral"}>
              {EVENT_LABEL[e.type as keyof typeof EVENT_LABEL] ?? e.type}
            </Stamp>
            {editable ? (
              <form action={deleteMatchEventForm}>
                <input type="hidden" name="eventId" value={e.id} />
                <RemoveEventButton />
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecordButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" disabled={pending || disabled}>
      {pending ? "Recording…" : "Record event"}
    </Button>
  );
}

function RemoveEventButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label="Remove event">
      ✕
    </Button>
  );
}