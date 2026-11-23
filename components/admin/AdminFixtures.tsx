"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, SectionHeading, Stamp } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TeamCrest } from "@/components/TeamCrest";
import {
  createFinalForm,
  deleteMatchForm,
  generateFixturesForm,
  saveMatch,
  saveMatchForm,
  setMatchPhotoForm,
  updateScoreForm,
} from "@/app/actions/admin";
import { FORMATS, MATCH_STAGES, stageLabel, type FormatId } from "@/lib/stages";
import { localInputToIso, toLocalInputValue } from "@/lib/format";
import type { Tournament, Team, Match } from "@/lib/db/schema";

export function AdminFixtures({
  tournament,
  teams,
  matches,
}: {
  tournament: Tournament;
  teams: Team[];
  matches: Match[];
}) {
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  // Only a tri-series seeds its final from the table. A knockout cup already
  // has its bracket, and a league has no final at all.
  const canHaveFinal = tournament.format === "tri_series";
  const hasFinal = matches.some((m) => m.stage === "final");

  return (
    <section>
      <SectionHeading
        title="Fixtures & scores"
        eyebrow={`${matches.length} matches`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canHaveFinal && !hasFinal ? (
              <form action={createFinalForm}>
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <CreateFinalButton disabled={teams.length < 2} />
              </form>
            ) : null}
            <form action={generateFixturesForm}>
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <GenerateButton disabled={teams.length < 2 || matches.length > 0} />
            </form>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {matches.length === 0 ? (
            <Card className="ruling px-6 py-10 text-center text-sm text-[var(--ink-3)]">
              {teams.length < 2
                ? "Create at least two teams, then generate the fixtures."
                : "No fixtures yet — click “Generate round-robin”."}
            </Card>
          ) : (
            matches.map((match) => (
              <MatchEditor
                key={match.id}
                match={match}
                teams={teams}
                homeName={teamName.get(match.homeTeamId) ?? "?"}
                awayName={teamName.get(match.awayTeamId) ?? "?"}
                format={tournament.format}
              />
            ))
          )}
        </div>

        <AddFixture tournamentId={tournament.id} teams={teams} format={tournament.format} />
      </div>
    </section>
  );
}

function MatchEditor({
  match,
  teams,
  homeName,
  awayName,
  format,
}: {
  match: Match;
  teams: Team[];
  homeName: string;
  awayName: string;
  format: string;
}) {
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? "");
  const [status, setStatus] = useState(match.status);
  const [kickoffLocal, setKickoffLocal] = useState(toLocalInputValue(match.scheduledAt));
  const [scheduledIso, setScheduledIso] = useState(
    match.scheduledAt ? new Date(match.scheduledAt).toISOString() : "",
  );
  const fixture = `${homeName} versus ${awayName}`;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 shrink-0 text-xs font-semibold text-[var(--ink-3)]">
          {stageLabel(match.stage, match.round, format)}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamCrest team={teams.find((t) => t.id === match.homeTeamId) ?? teams[0]!} size={26} />
          <span className="truncate text-sm font-semibold text-[var(--ink)]">{homeName}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            aria-label={`${homeName} score`}
            inputMode="numeric"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            placeholder="–"
            className="w-14 px-2 text-center tabular-nums"
          />
          <span className="text-sm font-bold text-[var(--ink-3)]">–</span>
          <Input
            aria-label={`${awayName} score`}
            inputMode="numeric"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            placeholder="–"
            className="w-14 px-2 text-center tabular-nums"
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-sm font-semibold text-[var(--ink)]">{awayName}</span>
          <TeamCrest team={teams.find((t) => t.id === match.awayTeamId) ?? teams[0]!} size={26} />
        </div>
      </div>

      <form
        action={updateScoreForm}
        className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--rule)] pt-3"
      >
        <input type="hidden" name="matchId" value={match.id} />
        <input type="hidden" name="homeScore" value={homeScore} />
        <input type="hidden" name="awayScore" value={awayScore} />

        <div className="min-w-32">
          <Field label="Status" htmlFor={`status-${match.id}`}>
            <Select
              id={`status-${match.id}`}
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">Live now</option>
              <option value="finished">Finished</option>
            </Select>
          </Field>
        </div>

        <SaveButton
          disabled={homeScore === "" || awayScore === ""}
          label="Save score"
          pendingLabel="Saving score…"
          aria-label={`Save score for ${fixture}`}
        />

        <div className="ml-auto flex items-center gap-2">
          <Input
            name="photoUrl"
            type="url"
            defaultValue={match.photoUrl ?? ""}
            placeholder="Match photo URL"
            aria-label="Match photo URL"
            className="min-h-9 w-44 py-1.5 text-sm"
          />
          <SaveButton
            variant="secondary"
            label="Photo"
            pendingLabel="Saving…"
            aria-label={`Save photo URL for ${fixture}`}
            formAction={setMatchPhotoForm}
          />
        </div>
      </form>

      {/* Stage is stored per match, so any competition shape can be edited
          here without changing code — including adding a final by hand. */}
      <form
        action={saveMatchForm}
        className="mt-2 flex flex-wrap items-end gap-2 border-t border-[var(--rule)] pt-3"
      >
        <input type="hidden" name="matchId" value={match.id} />
        <input type="hidden" name="tournamentId" value={match.tournamentId} />
        <input type="hidden" name="homeTeamId" value={match.homeTeamId} />
        <input type="hidden" name="awayTeamId" value={match.awayTeamId} />
        <input type="hidden" name="venue" value={match.venue ?? ""} />
        {/* The browser converts the organiser's local input to an ISO instant
            below; the server must never parse a zone-less datetime-local. */}
        <input type="hidden" name="scheduledAt" value={scheduledIso} />

        <div className="min-w-32 flex-1">
          <Field label="Stage" htmlFor={`stage-${match.id}`}>
            <Select id={`stage-${match.id}`} name="stage" defaultValue={match.stage}>
              <StageOptions format={format} current={match.stage} />
            </Select>
          </Field>
        </div>

        <div className="min-w-40 flex-1">
          <Field label="Kickoff (your local time)" htmlFor={`kickoff-${match.id}`}>
            <Input
              id={`kickoff-${match.id}`}
              type="datetime-local"
              value={kickoffLocal}
              onChange={(event) => {
                setKickoffLocal(event.target.value);
                setScheduledIso(localInputToIso(event.target.value));
              }}
            />
          </Field>
        </div>
        <div className="w-20">
          <Field label="Round" htmlFor={`round-${match.id}`}>
            <Input
              id={`round-${match.id}`}
              name="round"
              type="number"
              min={1}
              defaultValue={match.round}
            />
          </Field>
        </div>
        <div className="min-w-40 flex-1">
          <Field label="Notes" htmlFor={`notes-${match.id}`}>
            <Input
              id={`notes-${match.id}`}
              name="notes"
              defaultValue={match.notes ?? ""}
              placeholder="Optional note"
            />
          </Field>
        </div>
        <SaveButton
          variant="secondary"
          label="Save stage"
          pendingLabel="Saving stage…"
          aria-label={`Save stage and kickoff for ${fixture}`}
        />
      </form>

      {/* Outside the score form: ConfirmDialog renders its own <form> and
          forms cannot nest. */}
      <div className="mt-2 flex justify-end">
        <ConfirmDialog
          action={deleteMatchForm}
          triggerLabel="Delete fixture"
          triggerAriaLabel={`Delete fixture: ${fixture}`}
          title="Delete this fixture?"
          body={
            <>
              {homeName} vs {awayName} is removed along with its score and any recorded
              events. The standings and top scorers recalculate immediately. This cannot be
              undone.
            </>
          }
        >
          <input type="hidden" name="matchId" value={match.id} />
        </ConfirmDialog>
      </div>
    </Card>
  );
}

function AddFixture({
  tournamentId,
  teams,
  format,
}: {
  tournamentId: string;
  teams: Team[];
  format: string;
}) {
  const [state, formAction] = useActionState(saveMatch, { ok: false });

  // A side is filtered out of the other dropdown, so "Team 1 vs Team 1" cannot
  // be picked in the first place. The server rejects it regardless.
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [kickoffLocal, setKickoffLocal] = useState("");
  const [scheduledIso, setScheduledIso] = useState("");

  return (
    <Card className="p-5">
      <h3 className="font-bold text-[var(--ink)]">Add a fixture</h3>
      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="tournamentId" value={tournamentId} />

        <Field label="Home team" htmlFor="homeTeam" required error={state.fieldErrors?.homeTeamId?.[0]}>
          <Select
            id="homeTeam"
            name="homeTeamId"
            required
            value={homeTeamId}
            onChange={(e) => {
              setHomeTeamId(e.target.value);
              // Keep the two sides from converging on one team.
              if (e.target.value === awayTeamId) setAwayTeamId("");
            }}
          >
            <option value="">Choose…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Away team" htmlFor="awayTeam" required error={state.fieldErrors?.awayTeamId?.[0]}>
          <Select
            id="awayTeam"
            name="awayTeamId"
            required
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.target.value)}
          >
            <option value="">Choose…</option>
            {teams
              .filter((t) => t.id !== homeTeamId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Round" htmlFor="round">
          <Input id="round" name="round" type="number" min={1} defaultValue={1} className="w-24" />
        </Field>

        <Field label="Stage" htmlFor="stage">
          <Select id="stage" name="stage" defaultValue="group">
            <StageOptions format={format} />
          </Select>
        </Field>

        {/* Hidden ISO instant is what the server validates; the visible field
            stays in the organiser's local time. */}
        <input type="hidden" name="scheduledAt" value={scheduledIso} />
        <Field label="Kickoff (your local time)" htmlFor="scheduledAt">
          <Input
            id="scheduledAt"
            type="datetime-local"
            value={kickoffLocal}
            onChange={(event) => {
              setKickoffLocal(event.target.value);
              setScheduledIso(localInputToIso(event.target.value));
            }}
          />
        </Field>

        <Field label="Venue" htmlFor="matchVenue">
          <Input id="matchVenue" name="venue" placeholder="Pitch 1" />
        </Field>

        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" placeholder="Optional match note" className="min-h-16" />
        </Field>

        {state.message ? (
          <p role="status">
            <Stamp tone={state.ok ? "pitch" : "live"}>{state.message}</Stamp>
          </p>
        ) : null}

        <SaveButton block disabled={teams.length < 2} label="Add fixture" pendingLabel="Adding…" />
      </form>
    </Card>
  );
}

/** Stage options follow the tournament format, but never hide a legacy value
 *  already stored on a fixture (an old final in a league must stay editable). */
function StageOptions({ format, current }: { format: string; current?: string }) {
  const config = FORMATS[format as FormatId] ?? FORMATS.league;
  const stages: string[] = MATCH_STAGES.filter((stage) => {
    if (stage === "group") return config.hasGroups;
    if (stage === "final") return config.hasKnockout;
    return true;
  });
  if (current && !stages.includes(current)) stages.push(current);
  return (
    <>
      {stages.map((stage) => (
        <option key={stage} value={stage}>
          {stageLabel(stage, 1, format)}
        </option>
      ))}
    </>
  );
}

/**
 * useFormStatus only sees a form when the hook is called inside it. Calling it
 * in the parent made every "Saving…" state dead code.
 */
function SaveButton({
  label,
  pendingLabel,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={disabled || pending}>
      {pending ? pendingLabel : label}
      <span className="sr-only" aria-live="polite">
        {pending ? `${label} in progress` : ""}
      </span>
    </Button>
  );
}

function CreateFinalButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled}>
      {pending ? "Creating…" : "Create final from table"}
    </Button>
  );
}

function GenerateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending || disabled}>
      {pending ? "Generating…" : "Generate round-robin"}
    </Button>
  );
}
