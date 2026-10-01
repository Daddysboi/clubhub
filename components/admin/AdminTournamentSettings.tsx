"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, SectionHeading, Stamp } from "@/components/ui/card";
import { TeamCrest } from "@/components/TeamCrest";
import { deleteTournamentForm, saveTournament, setWinnerForm } from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { slugify } from "@/lib/format";
import type { Tournament, Team } from "@/lib/db/schema";

export function AdminTournamentSettings({
  tournament,
  teams,
}: {
  tournament: Tournament;
  teams: Team[];
}) {
  const [state, formAction] = useActionState(saveTournament, { ok: false });
  const [name, setName] = useState(tournament.name);

  return (
    <section>
      <SectionHeading title="Tournament settings" eyebrow="Configure" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold text-[var(--ink)]">Details</h3>
          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="tournamentId" value={tournament.id} />

            <Field label="Name" htmlFor="tName" required>
              <Input
                id="tName"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>

            <Field label="URL slug" htmlFor="tSlug" required hint={`/tournaments/${slugify(name)}`}>
              <Input id="tSlug" name="slug" defaultValue={tournament.slug} required />
            </Field>

            <Field label="Start date" htmlFor="tDate">
              <Input
                id="tDate"
                name="startDate"
                type="date"
                defaultValue={tournament.startDate ?? ""}
              />
            </Field>

            <Field
              label="Club name"
              htmlFor="tClub"
              hint="Shown in the public header, e.g. A Mastic FC competition"
            >
              <Input id="tClub" name="clubName" defaultValue={tournament.clubName ?? ""} />
            </Field>

            <Field label="Venue" htmlFor="tVenue">
              <Input id="tVenue" name="venue" defaultValue={tournament.venue ?? ""} />
            </Field>

            <Field
              label="Status"
              htmlFor="tStatus"
              hint="Set to done once the final is played."
            >
              <Select id="tStatus" name="status" defaultValue={tournament.status}>
                <option value="draft">Draft — hidden from public</option>
                <option value="live">Live — visible and open for signups</option>
                <option value="done">Done — completed</option>
              </Select>
            </Field>

            <Field label="Description" htmlFor="tDesc">
              <Input
                id="tDesc"
                name="description"
                defaultValue={tournament.description ?? ""}
              />
            </Field>

            {state.message ? (
              <Stamp tone={state.ok ? "pitch" : "live"}>{state.message}</Stamp>
            ) : null}

            <SaveSettings />
          </form>

          <div className="mt-6 border-t border-[var(--rule)] pt-4">
            <ConfirmDialog
              action={deleteTournamentForm}
              triggerLabel="Delete this tournament"
              size="md"
              title={`Delete ${tournament.name}?`}
              confirmLabel="Delete tournament"
              body="Every team, squad, fixture, score and stat for this competition is removed. Registered players are released. This cannot be undone."
            >
              <input type="hidden" name="tournamentId" value={tournament.id} />
            </ConfirmDialog>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-[var(--ink)]">Champion</h3>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            Declaring a champion sets the status to done and shows the trophy banner on the public
            page.
          </p>

{tournament.winnerTeamId ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--trophy)]/40 bg-[var(--trophy-tint)] px-4 py-3">
                <TeamCrest
                  team={teams.find((t) => t.id === tournament.winnerTeamId) ?? teams[0]!}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--trophy)]">
                    Current champion
                  </p>
                  <p className="font-bold text-[var(--ink)]">
                    {teams.find((t) => t.id === tournament.winnerTeamId)?.name}
                  </p>
                </div>
                <form action={setWinnerForm}>
                  <input type="hidden" name="tournamentId" value={tournament.id} />
                  <input type="hidden" name="teamId" value="" />
                  <Button type="submit" variant="secondary" size="sm">
                    Clear champion
                  </Button>
                </form>
              </div>
            ) : null}

          <form action={setWinnerForm} className="mt-4 space-y-4">
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <Field label="Winning team" htmlFor="winner" required>
              <Select id="winner" name="teamId" required defaultValue="">
                <option value="">Choose…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <SaveWinner />
          </form>
        </Card>
      </div>
    </section>
  );
}

function SaveSettings() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}

function SaveWinner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? "Saving…" : "Declare champion"}
    </Button>
  );
}
