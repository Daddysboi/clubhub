import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "./index";
import {
  matchEvents,
  matches,
  memoryComments,
  memoryLikes,
  players,
  teamPlayers,
  teams,
  tournamentMemories,
  tournaments,
  type MatchEvent,
  type TeamWithCaptain,
} from "./schema";
import { computeStandings, type Standings } from "../standings";
import { isUuid } from "../format";
import { likeContains } from "../search";
import type { EngagementSnapshot, GalleryComment } from "../engagement";
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
  // A malformed route param would otherwise reach Postgres and blow up with
  // "invalid input syntax for type uuid".
  if (!isUuid(id)) return null;
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

/** Public photo album for one cup, in the order the organiser added them. */
export async function getTournamentMemories(tournamentId: string) {
  return db
    .select()
    .from(tournamentMemories)
    .where(eq(tournamentMemories.tournamentId, tournamentId))
    .orderBy(asc(tournamentMemories.createdAt), asc(tournamentMemories.id));
}

/** Photo counts per cup, so public listings can advertise the album. */
export async function getMemoryCountsByTournament(): Promise<Record<string, number>> {
  const rows = await db
    .select({ tournamentId: tournamentMemories.tournamentId, n: sql<number>`count(*)::int` })
    .from(tournamentMemories)
    .groupBy(tournamentMemories.tournamentId);
  return Object.fromEntries(rows.map((row) => [row.tournamentId, row.n]));
}

const MAX_PUBLIC_COMMENTS = 200;

async function loadMemoryComments(tournamentId: string, visitorId: string, limit?: number) {
  const query = db
    .select({
      id: memoryComments.id,
      memoryId: memoryComments.memoryId,
      visitorId: memoryComments.visitorId,
      authorName: memoryComments.authorName,
      body: memoryComments.body,
      createdAt: memoryComments.createdAt,
    })
    .from(memoryComments)
    .innerJoin(tournamentMemories, eq(memoryComments.memoryId, tournamentMemories.id))
    .where(eq(tournamentMemories.tournamentId, tournamentId))
    .orderBy(desc(memoryComments.createdAt), desc(memoryComments.id));

  const rows = limit ? await query.limit(limit) : await query;

  const grouped: Record<string, GalleryComment[]> = {};
  for (const row of rows) {
    (grouped[row.memoryId] ??= []).push({
      id: row.id,
      memoryId: row.memoryId,
      authorName: row.authorName,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      mine: row.visitorId === visitorId,
    });
  }
  // Newest first from the query; each photo reads chronologically.
  for (const comments of Object.values(grouped)) comments.reverse();
  return grouped;
}

/** Likes, own-likes and comments for one visitor, grouped by photo id. */
export async function getMemoryEngagement(
  tournamentId: string,
  visitorId: string,
): Promise<EngagementSnapshot> {
  const likeRows = await db
    .select({ memoryId: memoryLikes.memoryId, visitorId: memoryLikes.visitorId })
    .from(memoryLikes)
    .innerJoin(tournamentMemories, eq(memoryLikes.memoryId, tournamentMemories.id))
    .where(eq(tournamentMemories.tournamentId, tournamentId));

  const counts: Record<string, number> = {};
  const liked: string[] = [];
  for (const row of likeRows) {
    counts[row.memoryId] = (counts[row.memoryId] ?? 0) + 1;
    if (row.visitorId === visitorId) liked.push(row.memoryId);
  }

  return {
    counts,
    liked,
    comments: await loadMemoryComments(tournamentId, visitorId, MAX_PUBLIC_COMMENTS),
  };
}

/** All comments for the organiser's moderation panel. */
export async function getAdminMemoryComments(tournamentId: string) {
  return loadMemoryComments(tournamentId, "");
}

export async function getTournamentPlayers(tournamentId: string) {
  return db
    .select()
    .from(players)
    .where(eq(players.tournamentId, tournamentId))
    .orderBy(asc(players.fullName));
}

/**
 * Public roster: never selects phone, and never includes a player who has not
 * been put in a squad.
 *
 * The inner join is the privacy boundary. An open `/join` form means anyone can
 * submit a name, and a left join would publish every one of those submissions on
 * the public players page before an organiser has looked at them. Only players
 * attached to a team are part of a competition's public record.
 */
export async function getPublicPlayers(tournamentId?: string) {
  // Draft cups have no public page; their squads must not leak through search
  // or the public roster either.
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
    .innerJoin(teamPlayers, eq(teamPlayers.playerId, players.id))
    .innerJoin(tournaments, eq(tournaments.id, players.tournamentId));

  const conditions = [ne(tournaments.status, "draft")];
  if (tournamentId) conditions.push(eq(players.tournamentId, tournamentId));

  return base.where(and(...conditions)).orderBy(
    tournamentId ? asc(players.fullName) : desc(players.createdAt),
  );
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
  // A final or a semi-final is not a league game. Only the group phase feeds
  // the table, otherwise a decider would inflate played/points/goals.
  return computeStandings(teamRows, matchRows, ["group"]);
}

/**
 * Name search over the public roster.
 *
 * Inner join, same privacy boundary as `getPublicPlayers`: search must not
 * become a way to enumerate players who have not been placed in a squad.
 */
export async function searchPlayers(query: string, scope?: string, limit = 50) {
  const q = query.trim();
  if (!q) return getPublicPlayers(scope);

  const pattern = likeContains(q);
  const conditions = [ilike(players.fullName, pattern), ne(tournaments.status, "draft")];
  if (scope) conditions.push(eq(players.tournamentId, scope));

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
    .innerJoin(teamPlayers, eq(teamPlayers.playerId, players.id))
    .innerJoin(tournaments, eq(tournaments.id, players.tournamentId))
    .where(and(...conditions))
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

/**
 * Every player the organiser can act on, across all competitions.
 *
 * Left join on the squad and a left join to the tournament, so two groups that
 * are otherwise invisible to admin still appear: players who signed up without
 * choosing a competition (`tournament_id is null`), and players registered to a
 * competition but never placed in a squad. An inner join on either side would
 * drop both groups, leaving no way to delete them from anywhere.
 *
 * Admin-only by construction: this selects `phone`, which the public roster
 * query deliberately never does.
 */
export async function listAllPlayersForAdmin() {
  return db
    .select({
      id: players.id,
      fullName: players.fullName,
      nickname: players.nickname,
      phone: players.phone,
      position: players.position,
      photoUrl: players.photoUrl,
      createdAt: players.createdAt,
      tournamentId: players.tournamentId,
      tournamentName: tournaments.name,
      teamId: teamPlayers.teamId,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(players)
    .leftJoin(teamPlayers, eq(teamPlayers.playerId, players.id))
    .leftJoin(teams, eq(teams.id, teamPlayers.teamId))
    .leftJoin(tournaments, eq(tournaments.id, players.tournamentId))
    .orderBy(desc(players.createdAt));
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

  const finishedMatches = matchList.filter((m) => m.status === "finished");

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
    finishedMatches,
    membership,
    teamNames,
  });

  // League records describe the group phase only. A cup final is a decider,
  // not another regular-season fixture.
  const teamStats = computeTeamStats(teamList, matchList, eventList, ["group"]);

  return {
    standings: computeStandings(teamList, matchList, ["group"]),
    teamStats,
    playerStats,
    scorers: topScorers(playerStats),
    bestAttack: bestAttack(teamStats),
    bestDefence: bestDefence(teamStats),
  };
}