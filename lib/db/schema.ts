/**
 * Drizzle schema mirrors the tables, constraints and indexes in
 * supabase/schema.sql. That SQL file remains the migration authority for RLS,
 * Storage policies and upgrades to existing databases; keep both in sync.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

export const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const;
export type Position = (typeof POSITIONS)[number];

export const TOURNAMENT_FORMATS = ["league", "tri_series", "knockout"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_STATUS = ["draft", "live", "done"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUS)[number];

export const MATCH_STAGES = ["group", "quarter", "semi", "final"] as const;
export type MatchStage = (typeof MATCH_STAGES)[number];

export const MATCH_STATUS = ["scheduled", "live", "finished"] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

export const EVENT_TYPES = [
  "goal",
  "own_goal",
  "penalty_goal",
  "penalty_miss",
  "yellow_card",
  "second_yellow",
  "red_card",
  "assist",
  "sub_on",
  "sub_off",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Events that count toward a player's goal tally. */
export const SCORING_EVENTS: ReadonlySet<EventType> = new Set<EventType>([
  "goal",
  "penalty_goal",
]);

/** Events that add a goal for a team, including own goals. */
export const SCORING_EVENTS_FOR_TEAM: ReadonlySet<EventType> = new Set<EventType>([
  "goal",
  "penalty_goal",
  "own_goal",
]);

/** Own goals count against the team that conceded them. */
export const OWN_GOAL_EVENTS: ReadonlySet<EventType> = new Set<EventType>(["own_goal"]);

/** Events that count as a booking against a player. */
export const CARD_EVENTS: ReadonlySet<EventType> = new Set<EventType>([
  "yellow_card",
  "second_yellow",
  "red_card",
]);

/** A second yellow counts as a red for suspension maths. */
export function isSendingOff(type: EventType): boolean {
  return type === "red_card" || type === "second_yellow";
}

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** Parent club when one club fields several teams in the same competition. */
    clubName: text("club_name"),
    description: text("description"),
    venue: text("venue"),
    startDate: date("start_date"),
    /** Competition shape: plain league, group phase + final, or knockout only. */
    format: text("format").notNull().default("league"),
    status: text("status").notNull().default("draft"),
    bannerUrl: text("banner_url"),
    winnerTeamId: uuid("winner_team_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("tournaments_format_check", sql`${t.format} in ('league','tri_series','knockout')`),
    check("tournaments_status_check", sql`${t.status} in ('draft','live','done')`),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** 2-4 char code on compact scorelines. Auto-filled as "T1".."T4". */
    shortName: text("short_name"),
    /** Team captain, always one of this team's own players. */
    captainPlayerId: uuid("captain_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    /** Team manager. Separate role from the captain, also from the squad. */
    managerPlayerId: uuid("manager_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    seed: integer("seed"),
    /** Backwards-compatible alias kept in sync with primaryColor. */
    color: text("color").notNull().default("#16a34a"),
    primaryColor: text("primary_color").notNull().default("#16a34a"),
    secondaryColor: text("secondary_color").notNull().default("#0f172a"),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("teams_tournament_idx").on(t.tournamentId),
    index("teams_captain_idx").on(t.captainPlayerId),
    index("teams_manager_idx").on(t.managerPlayerId),
  ],
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // nullable => standalone player, not tied to a tournament
    tournamentId: uuid("tournament_id").references(() => tournaments.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    nickname: text("nickname"),
    phone: text("phone"),
    position: text("position").notNull().default("Midfielder"),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("players_tournament_idx").on(t.tournamentId),
    index("players_full_name_lower_idx").on(sql`lower(btrim(${t.fullName}))`),
    index("players_nickname_lower_idx").on(sql`lower(btrim(${t.nickname}))`),
    check(
      "players_position_check",
      sql`${t.position} in ('Goalkeeper','Defender','Midfielder','Forward')`,
    ),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    round: integer("round").notNull().default(1),
    stage: text("stage").notNull().default("group"),
    homeTeamId: uuid("home_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    awayTeamId: uuid("away_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    venue: text("venue"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    status: text("status").notNull().default("scheduled"),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("matches_tournament_idx").on(t.tournamentId),
    uniqueIndex("matches_one_final_per_tournament_idx")
      .on(t.tournamentId)
      .where(sql`${t.stage} = 'final'`),
    check("matches_stage_check", sql`${t.stage} in ('group','quarter','semi','final')`),
    check("matches_status_check", sql`${t.status} in ('scheduled','live','finished')`),
    check("matches_round_positive_check", sql`${t.round} >= 1`),
    check(
      "matches_score_nonnegative_check",
      sql`(${t.homeScore} is null or ${t.homeScore} >= 0) and (${t.awayScore} is null or ${t.awayScore} >= 0)`,
    ),
    check(
      "matches_finished_score_check",
      sql`${t.status} <> 'finished' or (${t.homeScore} is not null and ${t.awayScore} is not null)`,
    ),
  ],
);

export const teamPlayers = pgTable(
  "team_players",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.playerId] }), index("team_players_player_idx").on(t.playerId)],
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    type: text("type").$type<EventType>().notNull(),
    minute: integer("minute"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("match_events_match_idx").on(t.matchId),
    index("match_events_tournament_idx").on(t.tournamentId),
    index("match_events_player_idx").on(t.playerId),
    uniqueIndex("match_events_dedupe_idx")
      .on(t.matchId, t.playerId, t.type, t.minute)
      .where(sql`${t.playerId} is not null`),
    uniqueIndex("match_events_card_dedupe_idx")
      .on(t.matchId, t.playerId, t.type)
      .where(
        sql`${t.playerId} is not null and ${t.type} in ('yellow_card','second_yellow','red_card')`,
      ),
    check(
      "match_events_type_check",
      sql`${t.type} in ('goal','own_goal','penalty_goal','penalty_miss','yellow_card','second_yellow','red_card','assist','sub_on','sub_off')`,
    ),
    check("match_events_minute_check", sql`${t.minute} is null or (${t.minute} >= 0 and ${t.minute} <= 130)`),
  ],
);

/**
 * Tournament photo album. A match has a single `photoUrl` for its hero shot;
 * this table is the documentary layer — many photos per cup, each with a caption
 * and an optional link to the fixture it remembers.
 */
export const tournamentMemories = pgTable(
  "tournament_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    caption: text("caption"),
    /** Intrinsic size, captured at upload so the gallery can reserve space. */
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tournament_memories_tournament_idx").on(t.tournamentId)],
);

/**
 * Anonymous engagement. `visitorId` is a UUID in a server-owned HttpOnly
 * cookie; it lets a visitor undo their own like and see their own comments
 * without forcing a sign-up. A client-supplied visitor ID is never trusted.
 */
export const memoryLikes = pgTable(
  "memory_likes",
  {
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => tournamentMemories.id, { onDelete: "cascade" }),
    visitorId: uuid("visitor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.visitorId] }), index("memory_likes_memory_idx").on(t.memoryId)],
);

export const memoryComments = pgTable(
  "memory_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => tournamentMemories.id, { onDelete: "cascade" }),
    visitorId: uuid("visitor_id").notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("memory_comments_memory_idx").on(t.memoryId), index("memory_comments_visitor_idx").on(t.visitorId)],
);

export const admins = pgTable("admins", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tournament = typeof tournaments.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type TournamentMemory = typeof tournamentMemories.$inferSelect;
export type MemoryLike = typeof memoryLikes.$inferSelect;
export type MemoryComment = typeof memoryComments.$inferSelect;

/** Team row plus the captain's and manager's public details, ready for rendering. */
export type TeamWithCaptain = Team & {
  captainName: string | null;
  captainNickname: string | null;
  captainPhotoUrl: string | null;
  managerName: string | null;
  managerNickname: string | null;
};

/**
 * Short code for compact scorelines and crests. Prefers the stored short name,
 * otherwise takes the number out of a numbered squad name ("Team 2" -> "T2"),
 * and finally falls back to the team's initials so a scoreline always has
 * something to render.
 */
export function teamCode(team: Pick<Team, "name" | "shortName" | "seed">): string {
  const short = team.shortName?.trim();
  if (short) return short.toUpperCase().slice(0, 4);

  const numbered = team.name.match(/(\d+)/);
  if (numbered) return `T${numbered[1]}`;

  const words = team.name.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }
  return team.name.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3);
}