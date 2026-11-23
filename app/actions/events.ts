"use server";

import { revalidatePath, refresh as refreshCurrentRoute } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/db/auth";
import { getMatchEvents } from "@/lib/db/queries";
import {
  CARD_EVENTS,
  matchEvents,
  matches,
  players,
  teamPlayers,
  teams,
} from "@/lib/db/schema";
import { isUuid } from "@/lib/format";
import { scorelineFromEvents } from "@/lib/stats";
import { eventSchema, firstError } from "@/lib/validation";
import type { ActionState } from "./players";

function refresh(tournamentId?: string | null) {
  refreshCurrentRoute();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/players");
  // Public routes are keyed by slug, so invalidate the whole segment instead of
  // deriving a slug from the tournament id.
  revalidatePath("/tournaments", "layout");
  if (tournamentId) {
    revalidatePath(`/admin/tournaments/${tournamentId}`);
  }
}

async function tournamentIdForMatch(matchId: string) {
  const rows = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Records a goal / card / substitution.
 *
 * Three guards:
 *  1. the team must be one of the two sides in this fixture,
 *  2. the player must actually be in that team's squad, and
 *  3. a card cannot be recorded twice for the same player in the same match.
 *
 * An own goal is credited against the scorer's own side (the conceding team);
 * reconciliation credits it to the opponent when rebuilding the scoreline.
 */
export async function addMatchEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = eventSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
    playerId: String(formData.get("playerId") ?? ""),
    teamId: String(formData.get("teamId") ?? ""),
    type: String(formData.get("type") ?? ""),
    minute: String(formData.get("minute") ?? ""),
    note: String(formData.get("note") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstError(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const match = await tournamentIdForMatch(data.matchId);
  if (!match) return { ok: false, message: "Match not found" };

  const team = await db.select().from(teams).where(eq(teams.id, data.teamId)).limit(1);
  const player = await db.select().from(players).where(eq(players.id, data.playerId)).limit(1);
  if (!team[0] || !player[0]) return { ok: false, message: "Player or team not found" };

  if (team[0].tournamentId !== match.tournamentId) {
    return { ok: false, message: "That team is not in this competition." };
  }
  if (player[0].tournamentId !== match.tournamentId) {
    return { ok: false, message: "That player is not registered in this competition." };
  }
  if (data.teamId !== match.homeTeamId && data.teamId !== match.awayTeamId) {
    return { ok: false, message: "That team is not playing in this fixture." };
  }

  const membership = await db
    .select({ teamId: teamPlayers.teamId })
    .from(teamPlayers)
    .where(and(eq(teamPlayers.teamId, data.teamId), eq(teamPlayers.playerId, data.playerId)))
    .limit(1);
  if (!membership[0]) {
    return { ok: false, message: "That player is not in this team's squad." };
  }

  const existing = await getMatchEvents(data.matchId);

  // Only bookings are once-per-match; a player may score any number of goals.
  // A second yellow is legitimate after an earlier yellow.
  if (CARD_EVENTS.has(data.type)) {
    const alreadyBooked = existing.some(
      (e) => e.playerId === data.playerId && e.type === data.type,
    );
    if (alreadyBooked) {
      return { ok: false, message: "That card is already recorded for this player." };
    }
  }

  try {
    await db.insert(matchEvents).values({
      matchId: data.matchId,
      tournamentId: match.tournamentId,
      playerId: data.playerId,
      teamId: data.teamId,
      type: data.type,
      minute: data.minute,
      note: data.note || null,
    });
  } catch {
    return { ok: false, message: "That exact event was already recorded." };
  }

  refresh(match.tournamentId);
  return { ok: true, message: "Event recorded" };
}

export async function deleteMatchEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  if (!isUuid(eventId)) return { ok: false, message: "Invalid event" };

  const rows = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
  if (!rows[0]) return { ok: false, message: "Event not found" };

  await db.delete(matchEvents).where(eq(matchEvents.id, eventId));
  refresh(rows[0].tournamentId);
  return { ok: true, message: "Event removed" };
}

/**
 * Cross-checks the scoreline against recorded goals.
 * Returns the delta so the admin can see exactly what is missing.
 */
export async function reconcileScore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  if (!isUuid(matchId)) return { ok: false, message: "Invalid match" };
  const match = await tournamentIdForMatch(matchId);
  if (!match) return { ok: false, message: "Match not found" };

  const events = await getMatchEvents(matchId);

  const { home: correctedHome, away: correctedAway } = scorelineFromEvents(
    match.homeTeamId,
    match.awayTeamId,
    events,
  );

  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;

  if (correctedHome === homeScore && correctedAway === awayScore) {
    return { ok: true, message: "Scoreline matches the recorded goals." };
  }

  await db
    .update(matches)
    .set({ homeScore: correctedHome, awayScore: correctedAway, status: "finished" })
    .where(eq(matches.id, matchId));

  refresh(match.tournamentId);
  return {
    ok: true,
    message: `Scoreline corrected to ${correctedHome}–${correctedAway} from recorded goals.`,
  };
}

/** Single-argument form-action wrapper for <form action>. */
export async function deleteMatchEventForm(formData: FormData): Promise<void> {
  await deleteMatchEvent({ ok: false }, formData);
}