import {
  CARD_EVENTS,
  SCORING_EVENTS,
  isSendingOff,
  type EventType,
  type MatchEvent,
  type Match,
  type Player,
  type Team,
} from "./db/schema";

export type PlayerIdentity = Pick<Player, "id" | "fullName" | "nickname" | "position">;

export type PlayerStatRow = {
  player: PlayerIdentity;
  teamId: string | null;
  teamName: string | null;
  goals: number;
  penalties: number;
  ownGoals: number;
  assists: number;
  yellowCards: number;
  secondYellows: number;
  redCards: number;
  /** Yellow + red points. Standard 2-point system: 2 for a yellow, 3 for a red. */
  cardPoints: number;
  appearances: number;
  minutesPlayed: number;
};

export type TopScorer = PlayerStatRow & { rank: number };

export type TeamStatRow = {
  team: Team;
  cleanSheets: number;
  goalsScored: number;
  goalsConceded: number;
  biggestWin: number;
  winlessStreak: number;
  yellowCards: number;
  redCards: number;
};

/**
 * Builds per-player aggregates from raw match events.
 *
 * Only events attached to FINISHED matches count, so a mis-entered live
 * score can never leak into the leaderboards.
 *
 * `appearances` counts distinct matches a player appears in — derived from
 * squad membership, because we do not store a line-up per match.
 */
export function computePlayerStats(input: {
  players: PlayerIdentity[];
  events: MatchEvent[];
  finishedMatchIds: ReadonlySet<string>;
  membership: Map<string, string | null>;
  teamNames: Map<string, string>;
}): PlayerStatRow[] {
  const { players, events, finishedMatchIds, membership, teamNames } = input;

  const rows = new Map<string, PlayerStatRow>();
  for (const player of players) {
    const teamId = membership.get(player.id) ?? null;
    rows.set(player.id, {
      player,
      teamId,
      teamName: teamId ? (teamNames.get(teamId) ?? null) : null,
      goals: 0,
      penalties: 0,
      ownGoals: 0,
      assists: 0,
      yellowCards: 0,
      secondYellows: 0,
      redCards: 0,
      cardPoints: 0,
      appearances: 0,
      minutesPlayed: 0,
    });
  }

  const appearanceSets = new Map<string, Set<string>>();
  const maxMinuteByMatchPlayer = new Map<string, number>();

  for (const event of events) {
    if (!finishedMatchIds.has(event.matchId)) continue;
    if (!event.playerId) continue;

    const row = rows.get(event.playerId);
    if (!row) continue;

    const key = `${event.matchId}:${event.playerId}`;
    const matches = appearanceSets.get(event.playerId) ?? new Set<string>();
    matches.add(event.matchId);
    appearanceSets.set(event.playerId, matches);

    const minute = event.minute ?? 0;
    maxMinuteByMatchPlayer.set(
      key,
      Math.max(maxMinuteByMatchPlayer.get(key) ?? 0, minute),
    );

    applyEvent(row, event.type);
  }

  // Players who never produced an event still count as having appeared in
  // every match their team played. This keeps clean-sheet and appearance
  // maths honest without needing a line-up table.
  const appearancesByPlayer = new Map<string, number>();
  for (const player of players) appearancesByPlayer.set(player.id, 0);

  for (const [playerId, matches] of appearanceSets) {
    appearancesByPlayer.set(playerId, (appearancesByPlayer.get(playerId) ?? 0) + matches.size);
  }

  for (const row of rows.values()) {
    row.appearances = appearancesByPlayer.get(row.player.id) ?? 0;
    row.minutesPlayed = [...appearanceSets.get(row.player.id) ?? []].reduce(
      (sum, matchId) => sum + (maxMinuteByMatchPlayer.get(`${matchId}:${row.player.id}`) ?? 90),
      0,
    );
  }

  return [...rows.values()];
}

function applyEvent(row: PlayerStatRow, type: EventType) {
  if (type === "goal") {
    row.goals += 1;
  } else if (type === "penalty_goal") {
    row.goals += 1;
    row.penalties += 1;
  } else if (type === "own_goal") {
    row.ownGoals += 1;
  } else if (type === "assist") {
    row.assists += 1;
  }

  if (!CARD_EVENTS.has(type)) return;

  if (type === "yellow_card") {
    row.yellowCards += 1;
    row.cardPoints += 2;
  } else if (type === "second_yellow") {
    row.secondYellows += 1;
    row.redCards += 1;
    row.cardPoints += 3;
  } else if (type === "red_card") {
    row.redCards += 1;
    row.cardPoints += 3;
  }
}

/**
 * Golden Boot ladder. Ranked by goals, then fewer penalties scored,
 * then fewer appearances, then name. Only players with at least one goal
 * are eligible — a zero-goal "winner" is never meaningful.
 */
export function topScorers(stats: PlayerStatRow[], limit = 10): TopScorer[] {
  return stats
    .filter((s) => s.goals > 0)
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        a.penalties - b.penalties ||
        a.appearances - b.appearances ||
        a.player.fullName.localeCompare(b.player.fullName),
    )
    // Rank before slicing so a truncated ladder still reads 1, 2, 3.
    .map((s, i) => ({ ...s, rank: i + 1 }))
    .slice(0, limit);
}

/** Card ladder: most card points first. */
export function cardLeaders(stats: PlayerStatRow[], limit = 10) {
  return stats
    .filter((s) => s.yellowCards + s.redCards > 0)
    .sort(
      (a, b) =>
        b.cardPoints - a.cardPoints ||
        b.redCards - a.redCards ||
        b.yellowCards - a.yellowCards ||
        a.player.fullName.localeCompare(b.player.fullName),
    )
    .slice(0, limit);
}

/**
 * Team-level derived stats. A clean sheet = finished match, 0 conceded.
 *
 * Discipline totals are aggregated from `events` when supplied; without them
 * the card counts stay at zero rather than guessing from scorelines.
 */
export function computeTeamStats(
  teams: Team[],
  matches: Match[],
  events: MatchEvent[] = [],
): TeamStatRow[] {
  const rows = new Map<string, TeamStatRow>();
  for (const team of teams) {
    rows.set(team.id, {
      team,
      cleanSheets: 0,
      goalsScored: 0,
      goalsConceded: 0,
      biggestWin: 0,
      winlessStreak: 0,
      yellowCards: 0,
      redCards: 0,
    });
  }

  const finished = matches
    .filter((m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0));

  // Current winless run per team, tracked independently and reset by a win.
  const currentStreak = new Map<string, number>();

  for (const match of finished) {
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) continue;

    const hs = match.homeScore as number;
    const as = match.awayScore as number;

    home.goalsScored += hs;
    home.goalsConceded += as;
    away.goalsScored += as;
    away.goalsConceded += hs;

    if (as === 0) home.cleanSheets += 1;
    if (hs === 0) away.cleanSheets += 1;

    home.biggestWin = Math.max(home.biggestWin, hs - as);
    away.biggestWin = Math.max(away.biggestWin, as - hs);

    const homeWon = hs > as;
    const awayWon = as > hs;
    const drew = !homeWon && !awayWon;

    // Home: drew or lost = winless, won = breaks run.
    if (drew || awayWon) {
      const s = (currentStreak.get(home.team.id) ?? 0) + 1;
      currentStreak.set(home.team.id, s);
      home.winlessStreak = Math.max(home.winlessStreak, s);
    } else {
      currentStreak.delete(home.team.id);
    }

    // Away
    if (drew || homeWon) {
      const s = (currentStreak.get(away.team.id) ?? 0) + 1;
      currentStreak.set(away.team.id, s);
      away.winlessStreak = Math.max(away.winlessStreak, s);
    } else {
      currentStreak.delete(away.team.id);
    }
  }

  // Only count bookings from matches that actually count.
  const finishedIds = new Set(finished.map((m) => m.id));
  for (const e of events) {
    if (!e.teamId || !finishedIds.has(e.matchId)) continue;
    const row = rows.get(e.teamId);
    if (!row) continue;
    if (e.type === "yellow_card") row.yellowCards += 1;
    else if (isSendingOff(e.type)) row.redCards += 1;
  }

  return [...rows.values()];
}

/** Best defensive record = fewest goals conceded. */
export function bestDefence(teamStats: TeamStatRow[]) {
  if (teamStats.length === 0) return null;
  return [...teamStats].sort(
    (a, b) =>
      a.goalsConceded - b.goalsConceded ||
      a.cleanSheets - b.cleanSheets ||
      a.goalsScored - b.goalsScored,
  )[0];
}

/** Best attacking record = most goals scored. */
export function bestAttack(teamStats: TeamStatRow[]) {
  if (teamStats.length === 0) return null;
  return [...teamStats].sort(
    (a, b) => b.goalsScored - a.goalsScored || b.cleanSheets - a.cleanSheets,
  )[0];
}

/** Number of distinct events a player has, used by the duplicate-event guard. */
export function countPlayerEvents(events: MatchEvent[], playerId: string, type: EventType) {
  return events.filter((e) => e.playerId === playerId && e.type === type).length;
}

/** Event ordering for a match timeline: minute first, then type priority. */
export function sortEvents(events: MatchEvent[]): MatchEvent[] {
  const priority: Record<string, number> = {
    goal: 0,
    penalty_goal: 0,
    own_goal: 1,
    penalty_miss: 2,
    red_card: 3,
    second_yellow: 3,
    yellow_card: 4,
    assist: 5,
    sub_on: 6,
    sub_off: 7,
  };
  return [...events].sort(
    (a, b) => (a.minute ?? 999) - (b.minute ?? 999) || (priority[a.type] ?? 9) - (priority[b.type] ?? 9),
  );
}

/** Human label + tone for an event type. Single source of truth. */
export const EVENT_LABEL: Record<EventType, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  penalty_goal: "Penalty goal",
  penalty_miss: "Penalty missed",
  yellow_card: "Yellow card",
  second_yellow: "Second yellow",
  red_card: "Red card",
  assist: "Assist",
  sub_on: "Subbed on",
  sub_off: "Subbed off",
};

export const EVENT_TONE: Record<
  EventType,
  "pitch" | "live" | "warn" | "info" | "neutral" | "trophy"
> = {
  goal: "pitch",
  own_goal: "neutral",
  penalty_goal: "pitch",
  penalty_miss: "warn",
  yellow_card: "warn",
  second_yellow: "live",
  red_card: "live",
  assist: "info",
  sub_on: "info",
  sub_off: "neutral",
};

export { SCORING_EVENTS, isSendingOff };