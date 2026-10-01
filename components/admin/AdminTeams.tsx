"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, SectionHeading, Stamp } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerAvatar } from "@/components/PlayerRow";
import {
  assignPlayerForm,
  deleteTeamForm,
  randomizeTeamsForm,
  saveTeam,
setTeamRole,
  setTeamLogoForm,
} from "@/app/actions/admin";
import { KIT_PRESETS } from "@/lib/tones";
import { cn } from "@/lib/cn";
import { teamCode, type Tournament, type Team } from "@/lib/db/schema";

type PlayerLite = {
  id: string;
  fullName: string;
  nickname: string | null;
  position: string;
  photoUrl: string | null;
  teamId: string | null;
};

/**
 * Team creation, identity, captain assignment and the single assign-player
 * panel. Every mutation is a server action imported directly.
 */
export function AdminTeams({
  tournament,
  teams,
  players,
}: {
  tournament: Tournament;
  teams: Team[];
  players: PlayerLite[];
}) {
  // Third value is isPending. useFormStatus() cannot be used here: it only
  // sees the nearest <form> ancestor, and this component renders outside the
  // form it owns, so it would always report false.
  const [state, formAction, pending] = useActionState(saveTeam, { ok: false });
  const [name, setName] = useState("");
  // Which team card is showing its edit form, if any. Null = all collapsed.
  const [editingId, setEditingId] = useState<string | null>(null);
  const nextNumber = teams.length + 1;
  const [preset, setPreset] = useState(teams.length % KIT_PRESETS.length);
  const [kit, setKit] = useState<{ primary: string; secondary: string; label: string }>(
    KIT_PRESETS[teams.length % KIT_PRESETS.length],
  );

  // Every registered player is listed, not just the unassigned ones. A player
  // sits in exactly one squad, so re-picking someone who already has a team is
  // a transfer — which is how an organiser fixes a squad assignment made by
  // mistake. assignPlayer removes the old membership before inserting.
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const roster = [...players].sort((a, b) => {
    const aTeam = a.teamId ? 0 : 1;
    const bTeam = b.teamId ? 0 : 1;
    if (aTeam !== bTeam) return aTeam - bTeam;
    return a.fullName.localeCompare(b.fullName);
  });
  const unassignedCount = players.filter((p) => !p.teamId).length;

  return (
    <section>
      <SectionHeading
        title="Teams"
        eyebrow={`${teams.length} created`}
        action={
          <RandomizeButton
            tournamentId={tournament.id}
            disabled={teams.length < 2 || players.length === 0}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {teams.map((team) => {
            const squad = players.filter((p) => p.teamId === team.id);
            return (
              <Card key={team.id} className="overflow-hidden">
                <header
                  className="flex items-center gap-3 border-b border-[var(--rule)] px-4 py-3"
                  style={{
                    background: `linear-gradient(90deg, ${team.primaryColor}14, transparent 70%)`,
                  }}
                >
                  <TeamCrest team={team} size={32} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--ink)]">{team.name}</p>
                    <p className="truncate text-xs text-[var(--ink-3)]">
                      Squad {teamCode(team)}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--ink-3)]">{squad.length}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-expanded={editingId === team.id}
                    onClick={() => setEditingId(editingId === team.id ? null : team.id)}
                    className="ml-auto"
                  >
                    {editingId === team.id ? "Close" : "Edit"}
                  </Button>
                  <ConfirmDialog
                    action={deleteTeamForm}
                    triggerLabel="Delete"
                    title={`Delete ${team.name}?`}
                    body={
                      <>
                        This removes the squad and its {squad.length}{" "}
                        {squad.length === 1 ? "player" : "players"}, along with any fixtures and
                        results they appear in. This cannot be undone.
                      </>
                    }
                  >
                    <input type="hidden" name="teamId" value={team.id} />
                  </ConfirmDialog>
                </header>

                {editingId === team.id ? <EditTeamForm team={team} /> : null}

                <div className="px-4 py-3">
                  {squad.length === 0 ? (
                    <p className="ruling py-4 text-center text-sm text-[var(--ink-3)]">
                      No players yet — assign them below.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {squad.map((p) => {
                        const isCaptain = team.captainPlayerId === p.id;
                        const isManager = team.managerPlayerId === p.id;
                        return (
                          <li key={p.id} className="flex items-center gap-2.5">
                            <PlayerAvatar player={p} size={26} />
                            <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-2)]">
                              {p.fullName}
                            </span>
                            {isCaptain ? <Stamp tone="warn">C</Stamp> : null}
                            {isManager ? <Stamp tone="info">M</Stamp> : null}
                            <span className="text-xs text-[var(--ink-3)]">{p.position}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <RolePicker team={team} squad={squad} role="captain" label="Captain" />
                <RolePicker team={team} squad={squad} role="manager" label="Manager" />

                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rule)] px-4 py-2.5">
                  <form action={setTeamLogoForm} className="flex min-w-0 flex-1 items-center gap-2">
                    <input type="hidden" name="teamId" value={team.id} />
                    <Input
                      name="logoUrl"
                      type="url"
                      defaultValue={team.logoUrl ?? ""}
                      placeholder="Paste team logo image URL"
                      aria-label={`${team.name} logo URL`}
                      className="min-h-9 min-w-0 flex-1 py-1.5 text-sm"
                    />
                    <SubmitButton variant="secondary" size="sm">
                      Save logo
                    </SubmitButton>
                  </form>

                  {/* A separate form rather than a second submit button in the
                      one above: two fields both named logoUrl would collide, and
                      FormData.get returns the first, so an empty submit button
                      value would never reach setTeamLogo. */}
                  {team.logoUrl ? (
                    <form action={setTeamLogoForm}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="logoUrl" value="" />
                      <Button type="submit" variant="ghost" size="sm">
                        Clear
                      </Button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold text-[var(--ink)]">Add squad {nextNumber}</h3>
            <form action={formAction} className="mt-4 space-y-4">
              <input type="hidden" name="tournamentId" value={tournament.id} />

              <div>
                <span className="mb-1.5 block text-sm font-medium text-[var(--ink-2)]">
                  Kit colours
                </span>
                <p className="mb-2 text-xs text-[var(--ink-3)]">
                  Each squad gets its own colours and crest so the four sides are easy to
                  tell apart, even though they all come from the same club.
                </p>
                <div className="flex flex-wrap gap-2">
                  {KIT_PRESETS.map((p, i) => (
                    <button
                      key={p.primary}
                      type="button"
                      aria-label={`${p.label} kit`}
                      aria-pressed={preset === i}
                      onClick={() => {
                        setPreset(i);
                        setKit(p);
                      }}
                      className={cn(
                        "rounded-lg border-2 p-1 transition",
                        preset === i
                          ? "scale-105 border-[var(--ink)]"
                          : "border-transparent hover:border-[var(--rule-strong)]",
                      )}
                    >
                      <span
                        className="block size-9 rounded-md"
                        style={{
                          background: `linear-gradient(140deg, ${p.primary} 0%, ${p.primary} 55%, ${p.secondary} 100%)`,
                        }}
                      />
                    </button>
                  ))}
                </div>
                <input type="hidden" name="primaryColor" value={kit.primary} />
                <input type="hidden" name="secondaryColor" value={kit.secondary} />
              </div>

              <Field
                label="Team name"
                htmlFor="teamName"
                required
                error={state.fieldErrors?.name?.[0]}
              >
                <Input
                  id="teamName"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Team ${nextNumber}`}
                  required
                />
              </Field>

              <input type="hidden" name="shortName" value={`T${nextNumber}`} />

              {state.message ? (
                <Stamp tone={state.ok ? "pitch" : "live"}>{state.message}</Stamp>
              ) : null}

              <Button type="submit" disabled={pending} block aria-busy={pending}>
                {pending ? "Adding…" : "Add team"}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-[var(--ink)]">Assign or move a player</h3>
            <p className="mt-1 text-xs text-[var(--ink-3)]">
              {players.length === 0
                ? "No players have registered yet."
                : `${unassignedCount} waiting for a team. Picking someone who already has one moves them across.`}
            </p>

            <form action={assignPlayerForm} className="mt-4 space-y-4">
              <Field label="Team" htmlFor="assignTeam" required>
                <Select id="assignTeam" name="teamId" defaultValue="">
                  <option value="">— unassigned —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Player" htmlFor="assignPlayer" required>
                <Select id="assignPlayer" name="playerId" required defaultValue="">
                  <option value="">Choose a player…</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                      {p.nickname ? ` (${p.nickname})` : ""}
                      {p.teamId ? ` — now in ${teamNameById.get(p.teamId)}` : " — unassigned"}
                    </option>
                  ))}
                </Select>
              </Field>

              <SubmitButton variant="secondary" disabled={players.length === 0} block>
                Assign to team
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </section>
  );
}

/**
 * Renames a squad and re-picks its kit. Posts to the same saveTeam action used
 * for creation, distinguished by the hidden teamId, so the uniqueness rule and
 * the colour sync are shared rather than duplicated.
 */
function EditTeamForm({ team }: { team: Team }) {
  const [state, formAction, pending] = useActionState(saveTeam, { ok: false });
  const [name, setName] = useState(team.name);
  // Seeded from the current kit so the form is accurate before it is touched.
  const [kit, setKit] = useState(() => {
    const match = KIT_PRESETS.find((p) => p.primary === team.primaryColor);
    return match ?? { primary: team.primaryColor, secondary: team.secondaryColor, label: "Custom" };
  });

  return (
    <form
      action={formAction}
      className="border-b border-[var(--rule)] bg-[var(--sunken)]/40 px-4 py-3"
    >
      <input type="hidden" name="teamId" value={team.id} />
      <input type="hidden" name="tournamentId" value={team.tournamentId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Team name" htmlFor={`et-name-${team.id}`} required>
          <Input
            id={`et-name-${team.id}`}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field
          label="Short code"
          htmlFor={`et-short-${team.id}`}
          hint="Up to 4 characters, shown in the squad list."
        >
          <Input
            id={`et-short-${team.id}`}
            name="shortName"
            defaultValue={team.shortName ?? ""}
            placeholder="T1"
          />
        </Field>
      </div>

      <div className="mt-3">
        <span className="mb-1.5 block text-sm font-medium text-[var(--ink-2)]">
          Kit colours
        </span>
        <div className="flex flex-wrap gap-2">
          {KIT_PRESETS.map((p) => (
            <button
              key={p.primary}
              type="button"
              aria-label={`${p.label} kit`}
              aria-pressed={kit.primary === p.primary}
              onClick={() => setKit(p)}
              className={cn(
                "rounded-lg border-2 p-1 transition",
                kit.primary === p.primary
                  ? "scale-105 border-[var(--ink)]"
                  : "border-transparent hover:border-[var(--rule-strong)]",
              )}
            >
              <span
                className="block size-9 rounded-md"
                style={{
                  background: `linear-gradient(140deg, ${p.primary} 0%, ${p.primary} 55%, ${p.secondary} 100%)`,
                }}
              />
            </button>
          ))}
        </div>
        <input type="hidden" name="primaryColor" value={kit.primary} />
        <input type="hidden" name="secondaryColor" value={kit.secondary} />
      </div>

      {state.message ? (
        <Stamp tone={state.ok ? "pitch" : "live"} className="mt-3">
          {state.message}
        </Stamp>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Assign or clear one squad role (captain or manager). Only this team's own
 * players are listed. Rendered as a single non-wrapping row: fixed-width
 * label, flexible select, fixed-width button.
 */
function RolePicker({
  team,
  squad,
  role,
  label,
}: {
  team: Team;
  squad: PlayerLite[];
  role: "captain" | "manager";
  label: string;
}) {
  const [state, formAction, pending] = useActionState(setTeamRole, { ok: false });
  const fieldId = `${role}-${team.id}`;
  const selected =
    role === "manager" ? team.managerPlayerId : team.captainPlayerId;

  // Controlled, not defaultValue, so the select always shows a known value.
  //
  // The displayed value follows the action's own result rather than the `team`
  // prop. A revalidation can hand this component an older `team` prop after the
  // save has already succeeded, and syncing to that prop made a saved captain
  // snap back to "— none —" a moment later. The prop is only trusted for the
  // initial value, which is correct because a fresh page load always renders it
  // from the database.
  const serverValue = selected ?? "";
  const [choice, setChoice] = useState(serverValue);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const savedPlayerId = state.ok ? (state.playerId ?? "") : null;
  if (savedPlayerId !== null && savedPlayerId !== lastSaved) {
    setLastSaved(savedPlayerId);
    setChoice(savedPlayerId);
  }

  return (
    <div className="border-t border-[var(--rule)] px-4 py-2.5">
      <form
        action={formAction}
        className="flex flex-nowrap items-center gap-2"
      >
        <input type="hidden" name="teamId" value={team.id} />
        <input type="hidden" name="role" value={role} />
        <label
          className="w-16 shrink-0 text-xs font-medium text-[var(--ink-2)]"
          htmlFor={fieldId}
        >
          {label}
        </label>
        <Select
          id={fieldId}
          name="playerId"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={squad.length === 0 || pending}
          wrapperClassName="flex-1"
          className="min-h-9 py-1 text-sm"
        >
          <option value="">— none —</option>
          {squad.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.nickname ? ` (${p.nickname})` : ""}
            </option>
          ))}
        </Select>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={pending || squad.length === 0}
          aria-busy={pending}
          className="shrink-0"
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
      {state.message ? (
        <Stamp tone={state.ok ? "pitch" : "live"} className="mt-1.5">
          {state.message}
        </Stamp>
      ) : null}
    </div>
  );
}

function RandomizeButton({ tournamentId, disabled }: { tournamentId: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <form action={randomizeTeamsForm}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending || disabled}>
        {pending ? "Shuffling…" : "Randomise teams"}
      </Button>
    </form>
  );
}

function SubmitButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? "Working…" : children}
    </Button>
  );
}