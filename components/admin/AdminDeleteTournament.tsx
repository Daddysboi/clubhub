"use client";

import { deleteTournamentForm } from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Delete control for a tournament row on the /admin list.
 *
 * The same action already existed on the tournament Settings tab, but a
 * tournament is listed on /admin and that is where an organiser goes to manage
 * their competitions, so burying the only delete behind a click-through made it
 * look unavailable. The confirm copy names the counts so the blast radius is
 * concrete before anyone commits.
 */
export function AdminDeleteTournament({
  tournamentId,
  name,
  teamCount,
  playerCount,
  matchCount,
}: {
  tournamentId: string;
  name: string;
  teamCount: number;
  playerCount: number;
  matchCount: number;
}) {
  const n = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

  return (
    <ConfirmDialog
      action={deleteTournamentForm}
      triggerLabel="Delete"
      triggerClassName="px-2 py-1 text-xs"
      title={`Delete ${name}?`}
      confirmLabel="Delete tournament"
      body={
        <>
          <p>
            This permanently removes {n(teamCount, "team", "teams")},{" "}
            {n(matchCount, "fixture", "fixtures")} and all their scores and match events.
          </p>
          <p className="mt-2">
            {n(playerCount, "player", "players")} stay on the players list as standalone
            entries. This cannot be undone.
          </p>
        </>
      }
    >
      <input type="hidden" name="tournamentId" value={tournamentId} />
    </ConfirmDialog>
  );
}