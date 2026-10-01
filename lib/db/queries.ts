import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "./index";
import {
  matchEvents,
  matches,
  players,
  teamPlayers,
  teams,
  tournaments,
  type MatchEvent,
  type TeamWithCaptain,
} from "./schema";
import { computeStandings, type Standings } from "../standings";
import {
  bestAttack,
  bestDefence,
  computePlayerStats,
  computeTeamStats,
  topScorers,
  type PlayerStatRow,
  type TeamStatRow,
  type TopScorer,
} from "../stats";

export async function listTournaments() {
  return db
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.createdAt));
}

export async function getTournamentBySlug(slug: string) {
  const rows = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTournamentById(id: string) {
  const rows = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getTournamentTeams(tournamentId: string) {
  return db
    .select()
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.seed), asc(teams.name));
}

/** Teams joined to their captain's public details. Phone is never selected. */
export async function getTournamentTeamsWithCaptains(tournamentId: string) {
  const rows = await db
    .select({
      id: teams.id,
      tournamentId: teams.tournamentId,
      name: teams.name,
      shortName: teams.shortName,
      captainPlayerId: teams.captainPlayerId,
      managerPlayerId: teams.managerPlayerId,
      seed: teams.seed,
      color: teams.color,
      primaryColor: teams.primaryColor,
      secondaryColor: teams.secondaryColor,
      logoUrl: teams.logoUrl,
      createdAt: teams.createdAt,
      captainName: players.fullName,
      captainNickname: players.nickname,
      captainPhotoUrl: players.photoUrl,
      managerName: sql<string | null>`${alias(players, "manager").fullName}`,
      managerNickname: sql<string | null>`${alias(players, "manager").nickname}`,
    })
    .from(teams)
    .leftJoin(players, eq(players.id, teams.captainPlayerId))
    .leftJoin(
      alias(players, "manager"),
      eq(alias(players, "manager").id, teams.managerPlayerId),
    )
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.seed), asc(teams.name));

  return rows as TeamWithCaptain[];
}

export async function getTournamentMatches(tournamentId: string) {
  return db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(asc(matches.round), asc(matches.scheduledAt));
}

export async function getTournamentPlayers(tournamentId: string) {
  return db
    .select()
    .from(players)
    .where(eq(players.tournamentId, tournamentId))
    .orderBy(asc(players.fullName));
}

/** Public roster: never selects phone. */
export async function getPublicPlayers(tournamentId?: string) {
  const base = db
    .select({
      id: players.id,
      fullName: players.fullName,
      nickname: players.nickname,
      position: players.position,
      photoUrl: players.photoUrl,
      tournamentId: players.tournamentId,
      createdAt: players.createdAt,
      teamId: teamPlayers.teamId,
    })
    .from(players)
    .leftJoin(teamPlayers, eq(teamPlayers.playerId, players.id));

  return tournamentId
    ? base.where(eq(players.tournamentId, tournamentId)).orderBy(asc(players.fullName))
    : base.orderBy(desc(players.createdAt));
}

/** Duplicate check: case-insensitive match on full name OR nickname in the same scope. */
export async function findDuplicatePlayer(input: {
  fullName: string;
  nickname?: string | null;
  tournamentId?: string | null;
  excludeId?: string;
}) {
  const nameKey = input.fullName.trim().toLowerCase();
  const nickKey = input.nickname?.trim().toLowerCase();

  const terms = [sql`lower(btrim(${players.fullName})) = ${nameKey}`];
  if (nickKey) terms.push(sql`lower(btrim(${players.nickname})) = ${nickKey}`);

  const conditions = [or(...terms)];
  if (input.excludeId) {
    conditions.push(sql`${players.id} <> ${input.excludeId}`);
  }

  const scope =
    input.tournamentId === null || input.tournamentId === undefined
      ? isNull(players.tournamentId)
      : eq(players.tournamentId, input.tournamentId);

  const rows = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      nickname: players.nickname,
      tournamentId: players.tournamentId,
    })
    .from(players)
    .where(and(...conditions, scope))
    .limit(1);

  return rows[0] ?? null;
}

export async function getStandings(tournamentId: string): Promise<Standings> {
  const [teamRows, matchRows] = await Promise.all([
    getTournamentTeams(tournamentId),
    getTournamentMatches(tournamentId),
  ]);
  return computeStandings(teamRows, matchRows);
}

export async function searchPlayers(query: string, limit = 50) {
  const q = query.trim();
  if (!q) return getPublicPlayers();
  return db
    .select({
      id: players.id,
      fullName: players.fullName,
      nickname: players.nickname,
      position: players.position,
      photoUrl: players.photoUrl,
      tournamentId: players.tournamentId,
      createdAt: players.createdAt,
      teamId: teamPlayers.teamId,
    })
    .from(players)
    .leftJoin(teamPlayers, eq(teamPlayers.playerId, players.id))
    .where(ilike(players.fullName, `%${q}%`))
    .limit(limit);
}

export async function getPlayerWithTeam(playerId: string) {
  const rows = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      nickname: players.nickname,
      phone: players.phone,
      position: players.position,
      photoUrl: players.photoUrl,
      tournamentId: players.tournamentId,
      teamId: teamPlayers.teamId,
    })
    .from(players)
    .leftJoin(teamPlayers, eq(teamPlayers.playerId, players.id))
    .where(eq(players.id, playerId))
    .limit(1);
  return rows[0] ?? null;
}

/** All players for a tournament with their team assignment (admin board). */
export async function getPlayersForTournament(tournamentId: string) {
  return db
    .select({
      id: players.id,
      fullName: players.fullName,
      nickname: players.nickname,
      // Included so the admin edit dialog can prefill the field; without it
      // saving an unrelated edit would blank the stored number.
      phone: players.phone,
      position: players.position,
      photoUrl: players.photoUrl,
      createdAt: players.createdAt,
      teamId: teamPlayers.teamId,
    })
    .from(players)
    .leftJoin(teamPlayers, eq(teamPlayers.playerId, players.id))
    .where(eq(players.tournamentId, tournamentId))
    .orderBy(asc(players.fullName));
}

// ---------------- match events & statistics ----------------

export async function getMatchEvents(matchId: string) {
  return db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.matchId, matchId))
    .orderBy(asc(matchEvents.minute));
}

export type TournamentEventView = MatchEvent & {
  playerName: string | null;
  teamName: string | null;
};

/** Events joined to the scorer's name and team, ordered for a timeline. */
export async function getTournamentEvents(tournamentId: string) {
  return db
    .select({
      id: matchEvents.id,
      matchId: matchEvents.matchId,
      tournamentId: matchEvents.tournamentId,
      playerId: matchEvents.playerId,
      teamId: matchEvents.teamId,
      type: matchEvents.type,
      minute: matchEvents.minute,
      note: matchEvents.note,
      createdAt: matchEvents.createdAt,
      playerName: players.fullName,
      teamName: teams.name,
    })
    .from(matchEvents)
    .leftJoin(players, eq(players.id, matchEvents.playerId))
    .leftJoin(teams, eq(teams.id, matchEvents.teamId))
    .where(eq(matchEvents.tournamentId, tournamentId))
    .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt));
}

export type TournamentStats = {
  standings: Standings;
  teamStats: TeamStatRow[];
  playerStats: PlayerStatRow[];
  scorers: TopScorer[];
  bestAttack: TeamStatRow | null;
  bestDefence: TeamStatRow | null;
};

/**
 * Single call that assembles every leaderboard for a tournament.
 * Standings come from scores; player and team stats come from events.
 */
export async function getTournamentStats(tournamentId: string): Promise<TournamentStats> {
  const [teamList, matchList, eventList, roster] = await Promise.all([
    getTournamentTeams(tournamentId),
    getTournamentMatches(tournamentId),
    getTournamentEvents(tournamentId),
    getPlayersForTournament(tournamentId),
  ]);

  const finishedMatchIds = new Set(
    matchList.filter((m) => m.status === "finished").map((m) => m.id),
  );

  const membership = new Map(roster.map((p) => [p.id, p.teamId]));
  const teamNames = new Map(teamList.map((t) => [t.id, t.name]));

  const playerStats = computePlayerStats({
    players: roster.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      nickname: p.nickname,
      position: p.position,
    })),
    events: eventList,
    finishedMatchIds,
    membership,
    teamNames,
  });

  const teamStats = computeTeamStats(teamList, matchList, eventList);

  return {
    standings: computeStandings(teamList, matchList),
    teamStats,
    playerStats,
    scorers: topScorers(playerStats),
    bestAttack: bestAttack(teamStats),
    bestDefence: bestDefence(teamStats),
  };
}