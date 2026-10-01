"use server";

import { revalidatePath, refresh as refreshCurrentRoute } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/db/auth";
import { findDuplicatePlayer, getTournamentById, getTournamentTeams } from "@/lib/db/queries";
import { matches, players, teamPlayers, teams, tournaments } from "@/lib/db/schema";
import { roundRobinPairings } from "@/lib/standings";
import {
  assignSchema,
  roleSchema,
  firstError,
  matchSchema,
  playerEditSchema,
  scoreSchema,
  teamSchema,
  tournamentSchema,
} from "@/lib/validation";
import type { ActionState } from "./players";

function refresh(tournamentId?: string | null) {
  // refresh() refetches the current route's RSC payload, so a mutation shows its
  // own write immediately instead of rendering the previous one.
  refreshCurrentRoute();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/players");
  // Public tournament and join routes are keyed by slug, so invalidate the whole
  // segment rather than guessing a slug from the tournament id.
  revalidatePath("/tournaments", "layout");
  revalidatePath("/join", "layout");
  if (tournamentId) {
    // The organiser panel is keyed by id, not slug, so /admin alone does not
    // cover it — without this the panel keeps rendering the deleted row.
    revalidatePath(`/admin/tournaments/${tournamentId}`);
  }
}

/** Every player registered to a tournament, assigned or not. */
async function allPlayerIdsFor(tournamentId: string): Promise<string[]> {
  const rows = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.tournamentId, tournamentId));
  return rows.map((r) => r.id);
}

// ---------------- tournaments ----------------

export async function saveTournament(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = tournamentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    venue: String(formData.get("venue") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    status: String(formData.get("status") ?? "draft"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: firstError(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const id = String(formData.get("tournamentId") ?? "");

  const clash = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(sql`lower(${tournaments.slug}) = ${data.slug.toLowerCase()}`));
  if (clash[0] && clash[0].id !== id) {
    return { ok: false, message: "That URL slug is already used." };
  }

  const values = {
    name: data.name,
    slug: data.slug.toLowerCase(),
    description: data.description || null,
    clubName: data.clubName || null,
    venue: data.venue || null,
    startDate: data.startDate || null,
    status: data.status,
  };

  if (id) {
    await db.update(tournaments).set(values).where(eq(tournaments.id, id));
    refresh(id);
    return { ok: true, message: "Tournament updated" };
  }

  await db.insert(tournaments).values(values);
  refresh();
  return { ok: true, message: `Created "${data.name}". Add your teams next.` };
}

/**
 * Declaring a champion forces status to done. Reversing that has to clear the
 * winner too, otherwise the trophy banner would still show on a tournament
 * that is back open for signups.
 */
export async function setWinner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!tournamentId) return { ok: false, message: "Missing tournament" };

  if (!teamId) {
    await db
      .update(tournaments)
      .set({ winnerTeamId: null })
      .where(eq(tournaments.id, tournamentId));
    const slug = (await getTournamentById(tournamentId))?.slug;
    refresh(slug ?? tournamentId);
    return { ok: true, message: "Champion cleared" };
  }

  const team = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team[0] || team[0].tournamentId !== tournamentId) {
    return { ok: false, message: "That team is not in this tournament" };
  }

  await db
    .update(tournaments)
    .set({ winnerTeamId: teamId, status: "done" })
    .where(eq(tournaments.id, tournamentId));

  const slug = (await getTournamentById(tournamentId))?.slug;
  refresh(slug ?? tournamentId);
  return { ok: true, message: `${team[0].name} is the champion!` };
}

export async function deleteTournament(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("tournamentId") ?? "");
  if (!id) return { ok: false, message: "Missing tournament" };
  await db.delete(tournaments).where(eq(tournaments.id, id));
  refresh();
  return { ok: true, message: "Tournament deleted" };
}

// ---------------- teams ----------------

export async function saveTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = teamSchema.safeParse({
    tournamentId: String(formData.get("tournamentId") ?? ""),
    name: String(formData.get("name") ?? ""),
    shortName: String(formData.get("shortName") ?? ""),
    color: String(formData.get("primaryColor") ?? formData.get("color") ?? "#16a34a"),
    primaryColor: String(formData.get("primaryColor") ?? "#16a34a"),
    secondaryColor: String(formData.get("secondaryColor") ?? "#0f172a"),
    logoUrl: String(formData.get("logoUrl") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: firstError(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const teamId = String(formData.get("teamId") ?? "");

  const primary = data.primaryColor || data.color || "#16a34a";
  const values = {
    tournamentId: data.tournamentId,
    name: data.name,
    shortName: data.shortName || null,
    // `color` is a legacy alias; keep it in sync so older reads stay correct.
    color: primary,
    primaryColor: primary,
    secondaryColor: data.secondaryColor || "#0f172a",
    logoUrl: data.logoUrl || null,
  };

  // Two squads with the same name make the fixture dropdowns ambiguous, so
  // names are unique per tournament. Compared case-insensitively.
  const siblings = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.tournamentId, data.tournamentId));

  const clash = siblings.find(
    (t) => t.id !== teamId && t.name.trim().toLowerCase() === data.name.trim().toLowerCase(),
  );
  if (clash) {
    return { ok: false, message: `“${data.name}” already exists in this tournament.` };
  }

  if (teamId) {
    await db.update(teams).set(values).where(eq(teams.id, teamId));
  } else {
    // Squads are numbered in creation order, so the next one is count + 1.
    await db.insert(teams).values({ ...values, seed: siblings.length + 1 });
  }
  refresh(data.tournamentId);
  return { ok: true, message: teamId ? "Team updated" : `${data.name} added` };
}

/**
 * Promotes one of the team's own players to captain or manager. Passing an
 * empty value clears that role.
 */
export async function setTeamRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = roleSchema.safeParse({
    teamId: String(formData.get("teamId") ?? ""),
    role: String(formData.get("role") ?? "captain"),
    playerId: String(formData.get("playerId") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error.flatten().fieldErrors) };
  }

  const { teamId, role } = parsed.data;
  const playerId = parsed.data.playerId || null;
  const label = role === "manager" ? "Manager" : "Captain";

  const teamRows = await db
    .select({ tournamentId: teams.tournamentId, name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const team = teamRows[0];
  if (!team) return { ok: false, message: "Team not found" };

  if (playerId) {
    // Captain and manager must belong to this team, otherwise the crest and
    // the squad list would disagree.
    const member = await db
      .select({ id: teamPlayers.playerId, fullName: players.fullName })
      .from(teamPlayers)
      .innerJoin(players, eq(players.id, teamPlayers.playerId))
      .where(and(eq(teamPlayers.teamId, teamId), eq(teamPlayers.playerId, playerId)))
      .limit(1);
    if (!member[0]) {
      return { ok: false, message: "That player is not in this squad" };
    }
  }

  await db
    .update(teams)
    .set(role === "manager" ? { managerPlayerId: playerId } : { captainPlayerId: playerId })
    .where(eq(teams.id, teamId));
  refresh(team.tournamentId);

  return {
    ok: true,
    message: playerId ? `${label} saved` : `${label} cleared`,
    // Returned so the select can show exactly what was written. The `team` prop
    // can still arrive in an older version after a revalidation, which used to
    // snap the picker back to the previous value straight after a save.
    playerId: playerId ?? "",
  };
}

export async function deleteTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) return { ok: false, message: "Missing team" };
  const t = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  await db.delete(teams).where(eq(teams.id, teamId));
  refresh(t[0]?.tournamentId);
  return { ok: true, message: "Team removed" };
}

export async function setTeamLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "");
  const logoUrl = String(formData.get("logoUrl") ?? "");
  if (!teamId) return { ok: false, message: "Missing team" };
  const t = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  await db.update(teams).set({ logoUrl: logoUrl || null }).where(eq(teams.id, teamId));
  refresh(t[0]?.tournamentId);
  return { ok: true, message: "Logo updated" };
}

// ---------------- player assignment ----------------

export async function editPlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = playerEditSchema.safeParse({
    playerId: String(formData.get("playerId") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    position: String(formData.get("position") ?? ""),
    tournamentId: String(formData.get("tournamentId") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: firstError(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const tournamentId = data.tournamentId || null;

  const duplicate = await findDuplicatePlayer({
    fullName: data.fullName,
    nickname: data.nickname || null,
    tournamentId,
    excludeId: data.playerId,
  });
  if (duplicate) {
    return { ok: false, message: "Another player already uses that name or nickname." };
  }

  await db
    .update(players)
    .set({
      fullName: data.fullName,
      nickname: data.nickname || null,
      phone: data.phone || null,
      position: data.position,
      tournamentId,
    })
    .where(eq(players.id, data.playerId));

  refresh(tournamentId);
  return { ok: true, message: "Player updated" };
}

export async function assignPlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = assignSchema.safeParse({
    playerId: String(formData.get("playerId") ?? ""),
    teamId: String(formData.get("teamId") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: "Invalid assignment" };

  const { playerId, teamId } = parsed.data;

  const player = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player[0]) return { ok: false, message: "Player not found" };

  // Resolve the target team *before* touching membership. Deleting first and
  // validating after would silently unassign the player whenever the guard
  // below rejected the request.
  const target = teamId
    ? (await db.select().from(teams).where(eq(teams.id, teamId)).limit(1))[0]
    : undefined;

  if (teamId) {
    if (!target) return { ok: false, message: "Team not found" };
    if (target.tournamentId !== player[0].tournamentId) {
      return { ok: false, message: "Player and team belong to different tournaments." };
    }
  }

  // A player sits in exactly one team at a time, so a transfer is
  // remove-then-insert. team_players is keyed (team_id, player_id) rather than
  // player_id alone, so this delete is what stops a player sitting in two
  // squads at once.
  await db.delete(teamPlayers).where(eq(teamPlayers.playerId, playerId));

  if (target) {
    await db.insert(teamPlayers).values({ teamId: target.id, playerId });
    refresh(player[0].tournamentId);
    return { ok: true, message: `${player[0].fullName} → ${target.name}` };
  }

  refresh(player[0].tournamentId);
  return { ok: true, message: `${player[0].fullName} unassigned` };
}

export async function randomizeTeams(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  if (!tournamentId) return { ok: false, message: "Missing tournament" };

  const teamList = await getTournamentTeams(tournamentId);
  if (teamList.length < 2) return { ok: false, message: "Create at least two teams first." };

  const ids = await allPlayerIdsFor(tournamentId);
  if (ids.length === 0) return { ok: false, message: "No players registered yet." };

  // Clear existing assignments for every team in this tournament.
  await db.delete(teamPlayers).where(
    inArray(
      teamPlayers.teamId,
      teamList.map((t) => t.id),
    ),
  );

  // Fisher-Yates, so the shuffle is uniform rather than sort-random.
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Balanced allocation: round-robin across teams so squads stay even.
  const rows = shuffled.map((playerId, i) => ({
    teamId: teamList[i % teamList.length].id,
    playerId,
  }));
  await db.insert(teamPlayers).values(rows);

  refresh(tournamentId);
  return { ok: true, message: `Assigned ${rows.length} players across ${teamList.length} teams` };
}

// ---------------- fixtures & scores ----------------

export async function saveMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = matchSchema.safeParse({
    tournamentId: String(formData.get("tournamentId") ?? ""),
    homeTeamId: String(formData.get("homeTeamId") ?? ""),
    awayTeamId: String(formData.get("awayTeamId") ?? ""),
    round: String(formData.get("round") ?? "1"),
    scheduledAt: String(formData.get("scheduledAt") ?? ""),
    venue: String(formData.get("venue") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: firstError(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const matchId = String(formData.get("matchId") ?? "");

  // Both sides must belong to this tournament. Without this a hand-crafted
  // request could file a fixture between squads from two different
  // competitions, which then renders as an unresolvable standing.
  const sides = await db
    .select({ id: teams.id, tournamentId: teams.tournamentId })
    .from(teams)
    .where(inArray(teams.id, [data.homeTeamId, data.awayTeamId]));
  const foreign = sides.filter((t) => t.tournamentId !== data.tournamentId);
  if (sides.length !== 2 || foreign.length > 0) {
    return { ok: false, message: "Both teams must belong to this tournament." };
  }

  const values = {
    tournamentId: data.tournamentId,
    homeTeamId: data.homeTeamId,
    awayTeamId: data.awayTeamId,
    round: data.round,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    venue: data.venue || null,
    notes: data.notes || null,
  };

  if (matchId) {
    await db.update(matches).set(values).where(eq(matches.id, matchId));
  } else {
    await db.insert(matches).values(values);
  }

  const slug = (await getTournamentById(data.tournamentId))?.slug;
  refresh(slug ?? data.tournamentId);
  return { ok: true, message: matchId ? "Fixture updated" : "Fixture created" };
}

export async function generateFixtures(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  if (!tournamentId) return { ok: false, message: "Missing tournament" };

  const teamList = await getTournamentTeams(tournamentId);
  if (teamList.length < 2) return { ok: false, message: "Create at least two teams first." };

  const existing = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));
  if (existing.length > 0) {
    return { ok: false, message: "Fixtures already exist. Delete them first to regenerate." };
  }

  const teamIds = teamList.map((t) => t.id);
  const pairs = roundRobinPairings(teamIds);
  const perRound = Math.floor(teamIds.length / 2);

  await db.insert(matches).values(
    pairs.map(([home, away], i) => ({
      tournamentId,
      homeTeamId: home,
      awayTeamId: away,
      round: Math.floor(i / perRound) + 1,
    })),
  );

  await db.update(tournaments).set({ status: "live" }).where(eq(tournaments.id, tournamentId));

  const slug = (await getTournamentById(tournamentId))?.slug;
  refresh(slug ?? tournamentId);
  return {
    ok: true,
    message: `Created ${pairs.length} fixtures across ${teamList.length} teams — now live`,
  };
}

export async function updateScore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = scoreSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
    homeScore: String(formData.get("homeScore") ?? ""),
    awayScore: String(formData.get("awayScore") ?? ""),
    status: String(formData.get("status") ?? "finished"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: firstError(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const existing = await db.select().from(matches).where(eq(matches.id, data.matchId)).limit(1);
  if (!existing[0]) return { ok: false, message: "Match not found" };

  await db
    .update(matches)
    .set({ homeScore: data.homeScore, awayScore: data.awayScore, status: data.status })
    .where(eq(matches.id, data.matchId));

  const slug = (await getTournamentById(existing[0].tournamentId))?.slug;
  refresh(slug ?? existing[0].tournamentId);
  return { ok: true, message: "Score saved" };
}

export async function deleteMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { ok: false, message: "Missing match" };
  const m = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  await db.delete(matches).where(eq(matches.id, matchId));
  refresh(m[0]?.tournamentId);
  return { ok: true, message: "Match deleted" };
}

export async function setMatchPhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const photoUrl = String(formData.get("photoUrl") ?? "");
  if (!matchId) return { ok: false, message: "Missing match" };
  const m = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  await db.update(matches).set({ photoUrl: photoUrl || null }).where(eq(matches.id, matchId));
  refresh(m[0]?.tournamentId);
  return { ok: true, message: "Photo updated" };
}

// ---------------- single-argument form-action wrappers ----------------
// Next's <form action> expects (formData) => void | Promise<void>.
// Every export in a "use server" file must be an async function, so these are
// declared as functions rather than values produced by a higher-order helper.

export async function assignPlayerForm(formData: FormData): Promise<void> {
  await assignPlayer({ ok: false }, formData);
}
export async function deleteTeamForm(formData: FormData): Promise<void> {
  await deleteTeam({ ok: false }, formData);
}
export async function setTeamLogoForm(formData: FormData): Promise<void> {
  await setTeamLogo({ ok: false }, formData);
}
export async function randomizeTeamsForm(formData: FormData): Promise<void> {
  await randomizeTeams({ ok: false }, formData);
}
export async function updateScoreForm(formData: FormData): Promise<void> {
  await updateScore({ ok: false }, formData);
}
export async function setMatchPhotoForm(formData: FormData): Promise<void> {
  await setMatchPhoto({ ok: false }, formData);
}
export async function deleteMatchForm(formData: FormData): Promise<void> {
  await deleteMatch({ ok: false }, formData);
}
export async function generateFixturesForm(formData: FormData): Promise<void> {
  await generateFixtures({ ok: false }, formData);
}
export async function setWinnerForm(formData: FormData): Promise<void> {
  await setWinner({ ok: false }, formData);
}
export async function deleteTournamentForm(formData: FormData): Promise<void> {
  await deleteTournament({ ok: false }, formData);
}
export async function saveTeamForm(formData: FormData): Promise<void> {
  await saveTeam({ ok: false }, formData);
}
export async function editPlayerForm(formData: FormData): Promise<void> {
  await editPlayer({ ok: false }, formData);
}
