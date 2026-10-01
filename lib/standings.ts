import type { Match, Team } from "./db/schema";

export type StandingRow = {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: ("W" | "D" | "L")[];
  rank: number;
};

export type Standings = StandingRow[];

/**
 * Standings are always computed from finished matches — never stored.
 * Points: 3 win / 1 draw. Tie-breakers: points, goal diff, goals for, then name.
 */
export function computeStandings(teams: Team[], matches: Match[]): Standings {
  const played = new Map<string, StandingRow>();

  for (const team of teams) {
    played.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      form: [],
      rank: 0,
    });
  }

  const finished = matches.filter(
    (m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null,
  );

  for (const match of finished) {
    const home = played.get(match.homeTeamId);
    const away = played.get(match.awayTeamId);
    if (!home || !away) continue;

    const hs = match.homeScore as number;
    const as = match.awayScore as number;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;

    if (hs > as) {
      home.won += 1;
      home.points += 3;
      home.form.push("W");
      away.lost += 1;
      away.form.push("L");
    } else if (hs < as) {
      away.won += 1;
      away.points += 3;
      away.form.push("W");
      home.lost += 1;
      home.form.push("L");
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push("D");
      away.form.push("D");
    }
  }

  const rows = [...played.values()];
  for (const row of rows) row.goalDiff = row.goalsFor - row.goalsAgainst;

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name),
  );

  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return rows;
}

export function tournamentWinner(standings: Standings): StandingRow | null {
  if (standings.length === 0) return null;
  return standings[0];
}

const BYE = "__bye__";

/**
 * Round-robin pairings via the circle method: every team meets every other
 * team exactly once, with home/away sides alternating each round.
 *
 * An odd team count is padded with a `BYE` sentinel so every round stays
 * full; pairings that involve the sentinel are dropped, which is what
 * produces the resting round.
 *
 * The loop bound is explicit (`n - 1` rounds) and `arr` is rotated in place,
 * never rebuilt, so this cannot spin.
 */
export function roundRobinPairings(teamIds: string[]): [string, string][] {
  const ids = [...teamIds];
  if (ids.length < 2) return [];

  if (ids.length % 2 === 1) ids.push(BYE);

  const n = ids.length;
  const out: [string, string][] = [];
  let arr = [...ids];

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const left = arr[i];
      const right = arr[n - 1 - i];
      if (left === BYE || right === BYE) continue;
      // Flip sides on alternate rounds so hosting is shared fairly.
      out.push(r % 2 === 0 ? [left, right] : [right, left]);
    }
    // Rotate the tail while holding position 0 fixed.
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return out;
}

/** Single-elimination bracket for a power-of-two team count; returns round numbers. */
export function knockoutPairings(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  const ids = [...teamIds];
  for (let i = 0; i + 1 < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
  return pairs;
}