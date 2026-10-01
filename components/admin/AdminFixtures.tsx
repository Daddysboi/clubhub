"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, SectionHeading, Stamp } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TeamCrest } from "@/components/TeamCrest";
import {
  deleteMatchForm,
  generateFixturesForm,
  saveMatch,
  setMatchPhotoForm,
  updateScoreForm,
} from "@/app/actions/admin";
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

  return (
    <section>
      <SectionHeading
        title="Fixtures & scores"
        eyebrow={`${matches.length} matches`}
        action={
          <form action={generateFixturesForm}>
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <GenerateButton disabled={teams.length < 2 || matches.length > 0} />
          </form>
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
              />
            ))
          )}
        </div>

        <AddFixture tournamentId={tournament.id} teams={teams} />
      </div>
    </section>
  );
}

function MatchEditor({
  match,
  teams,
  homeName,
  awayName,
}: {
  match: Match;
  teams: Team[];
  homeName: string;
  awayName: string;
}) {
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? "");
  const [status, setStatus] = useState(match.status);
  const { pending } = useFormStatus();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-10 shrink-0 text-xs font-semibold text-[var(--ink-3)]">
          R{match.round}
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

        <Button type="submit" size="sm" disabled={pending || homeScore === "" || awayScore === ""}>
          {pending ? "Saving…" : "Save score"}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Input
            name="photoUrl"
            type="url"
            defaultValue={match.photoUrl ?? ""}
            placeholder="Match photo URL"
            aria-label="Match photo URL"
            className="min-h-9 w-44 py-1.5 text-sm"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            formAction={setMatchPhotoForm}
            disabled={pending}
          >
            Photo
          </Button>
        </div>
      </form>

      {/* Outside the score form: ConfirmDialog renders its own <form> and
          forms cannot nest. */}
      <div className="mt-2 flex justify-end">
        <ConfirmDialog
          action={deleteMatchForm}
          triggerLabel="Delete fixture"
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

function AddFixture({ tournamentId, teams }: { tournamentId: string; teams: Team[] }) {
  const [state, formAction] = useActionState(saveMatch, { ok: false });
  const { pending } = useFormStatus();

  // A side is filtered out of the other dropdown, so "Team 1 vs Team 1" cannot
  // be picked in the first place. The server rejects it regardless.
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");

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

        <Field label="Kickoff" htmlFor="scheduledAt">
          <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
        </Field>

        <Field label="Venue" htmlFor="matchVenue">
          <Input id="matchVenue" name="venue" placeholder="Pitch 1" />
        </Field>

        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" placeholder="Optional match note" className="min-h-16" />
        </Field>

        {state.message ? (
          <Stamp tone={state.ok ? "pitch" : "live"}>{state.message}</Stamp>
        ) : null}

        <Button type="submit" block disabled={pending || teams.length < 2}>
          {pending ? "Adding…" : "Add fixture"}
        </Button>
      </form>
    </Card>
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
