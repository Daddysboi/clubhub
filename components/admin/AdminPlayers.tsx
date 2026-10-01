"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, SectionHeading } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlayerAvatar, PositionBadge } from "@/components/PlayerRow";
import { editPlayerForm } from "@/app/actions/admin";
import { deletePlayerForm } from "@/app/actions/players";
import { POSITION_ORDER } from "@/lib/tones";
import type { Team } from "@/lib/db/schema";

type AdminPlayer = {
  id: string;
  fullName: string;
  nickname: string | null;
  phone: string | null;
  position: string;
  photoUrl: string | null;
  teamId: string | null;
};

/**
 * The organiser's roster. Phone numbers are visible here and nowhere else.
 */
export function AdminPlayers({
  tournamentId,
  players,
  teams,
}: {
  tournamentId: string;
  players: AdminPlayer[];
  teams: Team[];
}) {
  const [editing, setEditing] = useState<AdminPlayer | null>(null);
  const [query, setQuery] = useState("");

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const teamColor = new Map(teams.map((t) => [t.id, t.color]));

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? players.filter((p) => `${p.fullName} ${p.nickname ?? ""}`.toLowerCase().includes(needle))
    : players;

  return (
    <section>
      <SectionHeading title="Players" eyebrow={`${players.length} registered`} />

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--rule)] p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter players…"
            aria-label="Filter players"
          />
        </div>

        {visible.length === 0 ? (
          <p className="ruling px-4 py-8 text-center text-sm text-[var(--ink-3)]">
            {players.length === 0
              ? "No players have registered yet."
              : "No player matches that filter."}
          </p>
        ) : (
          visible.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 border-b border-[var(--rule)] px-4 py-3 last:border-0"
            >
              <PlayerAvatar player={p} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--ink)]">{p.fullName}</p>
                <p className="truncate text-xs text-[var(--ink-3)]">
                  {p.nickname ? `“${p.nickname}” · ` : ""}
                  {p.position}
                </p>
              </div>

              <PositionBadge position={p.position} />

              {p.teamId ? (
                <span
                  className="rounded-md px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: teamColor.get(p.teamId) ?? "var(--sunken)" }}
                >
                  {teamName.get(p.teamId)}
                </span>
              ) : (
                <span className="rounded-md border border-dashed border-[var(--rule-strong)] px-2.5 py-0.5 text-xs text-[var(--ink-3)]">
                  Unassigned
                </span>
              )}

              <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>
                Edit
              </Button>

              <ConfirmDialog
                action={deletePlayerForm}
                triggerLabel="Delete"
                title={`Remove ${p.fullName}?`}
                body={
                  <>
                    The player leaves the roster and is removed from{" "}
                    {p.teamId ? "their squad" : "the tournament"}. Any goals and cards recorded
                    for them are deleted. This cannot be undone.
                  </>
                }
              >
                <input type="hidden" name="playerId" value={p.id} />
              </ConfirmDialog>
            </div>
          ))
        )}
      </Card>

      {editing ? (
        <EditPlayerDialog
          player={editing}
          tournamentId={tournamentId}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function EditPlayerDialog({
  player,
  tournamentId,
  onClose,
}: {
  player: AdminPlayer;
  tournamentId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <Card className="w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-[var(--ink)]">Edit player</h3>
        <p className="mt-1 text-xs text-[var(--ink-3)]">
          Changes are re-checked against the duplicate-name rule.
        </p>

        <form action={editPlayerForm} className="mt-5 space-y-4">
          <input type="hidden" name="playerId" value={player.id} />
          <input type="hidden" name="tournamentId" value={tournamentId} />

          <Field label="Full name" htmlFor={`fn-${player.id}`} required>
            <Input
              id={`fn-${player.id}`}
              name="fullName"
              defaultValue={player.fullName}
              required
            />
          </Field>

          <Field label="Nickname" htmlFor={`nn-${player.id}`}>
            <Input id={`nn-${player.id}`} name="nickname" defaultValue={player.nickname ?? ""} />
          </Field>

          <Field label="Phone" htmlFor={`ph-${player.id}`} hint="Only you can see this.">
            {/* Without a default the field renders empty and editPlayer writes
                the empty value back, silently erasing the number on every save. */}
            <Input
              id={`ph-${player.id}`}
              name="phone"
              type="tel"
              defaultValue={player.phone ?? ""}
            />
          </Field>

          <Field label="Position" htmlFor={`pos-${player.id}`} required>
            <Select id={`pos-${player.id}`} name="position" defaultValue={player.position}>
              {POSITION_ORDER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex-1">
              <SaveButton />
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}