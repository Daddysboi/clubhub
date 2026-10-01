"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { Card, SectionHeading } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlayerAvatar, PositionBadge } from "@/components/PlayerRow";
import { deletePlayerForm } from "@/app/actions/players";

export type AdminDirectoryPlayer = {
  id: string;
  fullName: string;
  nickname: string | null;
  phone: string | null;
  position: string;
  photoUrl: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
};

/**
 * Every registered player, across every competition, on the organiser panel.
 *
 * This is the only place two whole groups are reachable:
 *
 *   - players who signed up without picking a competition, and
 *   - players registered to a competition but never placed in a squad.
 *
 * Neither has a tournament roster to live in, so without this list there is no
 * screen anywhere to delete them from.
 *
 * Phone numbers appear here and nowhere else. Admin-only: the public roster
 * query never selects `phone`, and only lists squad players.
 */
export function AdminAllPlayers({ players }: { players: AdminDirectoryPlayer[] }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "unassigned" | "standalone">("all");

  const needle = query.trim().toLowerCase();
  const visible = players.filter((p) => {
    if (needle && !`${p.fullName} ${p.nickname ?? ""} ${p.tournamentName ?? ""}`.toLowerCase().includes(needle))
      return false;
    if (scope === "unassigned") return !p.teamId;
    if (scope === "standalone") return !p.tournamentId;
    return true;
  });

  const unassignedCount = players.filter((p) => !p.teamId).length;
  const standaloneCount = players.filter((p) => !p.tournamentId).length;

  return (
    <section>
      <SectionHeading title="All players" eyebrow={`${players.length} registered`} />

      <Card className="overflow-hidden">
        {/* Filter row: search grows, the scope select stays a fixed slot so it
            does not reflow as the placeholder text changes. */}
        <div className="flex flex-col gap-2 border-b border-[var(--rule)] p-4 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players…"
            aria-label="Search players"
            className="min-w-0 flex-1"
          />
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            aria-label="Filter players"
            wrapperClassName="sm:w-56"
          >
            <option value="all">Everyone</option>
            <option value="unassigned">Not in a squad ({unassignedCount})</option>
            <option value="standalone">No competition ({standaloneCount})</option>
          </Select>
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
                  {p.phone ? ` · ${p.phone}` : ""}
                </p>
              </div>

              <PositionBadge position={p.position} />

              {/* Competition, then squad. Both can be absent, which is the whole
                  reason this list exists. */}
              <span className="truncate text-xs text-[var(--ink-3)]">
                {p.tournamentName ?? "No competition"}
              </span>

              {p.teamId ? (
                <span
                  className="rounded-md px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: p.teamColor ?? "var(--sunken)" }}
                >
                  {p.teamName}
                </span>
              ) : (
                <span className="rounded-md border border-dashed border-[var(--rule-strong)] px-2.5 py-0.5 text-xs text-[var(--ink-3)]">
                  Unassigned
                </span>
              )}

              <ConfirmDialog
                action={deletePlayerForm}
                triggerLabel="Delete"
                title={`Remove ${p.fullName}?`}
                body={
                  <>
                    This player is deleted for good, along with any squad place they held. Goals
                    and cards they scored stay in the match record with the name detached, so team
                    totals are unaffected.
                  </>
                }
              >
                <input type="hidden" name="playerId" value={p.id} />
              </ConfirmDialog>
            </div>
          ))
        )}
      </Card>
    </section>
  );
}