import type { Match, Team } from "@/lib/db/schema";
import {
  computeStandings,
  knockoutPairings,
  roundRobinPairings,
  tournamentWinner,
  type StandingRow,
} from "@/lib/standings";

let seq = 0;
const uid = () => `t${++seq}`;

function team(name: string, seed = 0): Team {
  return {
    id: uid(),
    tournamentId: "cup",
    name,
    shortName: null,
    captainPlayerId: null,
    managerPlayerId: null,
    seed,
    color: "#16a34a",
    primaryColor: "#16a34a",
    secondaryColor: "#0f172a",
    logoUrl: null,
    createdAt: new Date(0),
  };
}

function match(
  home: Team,
  away: Team,
  homeScore: number | null,
  awayScore: number | null,
  status: Match["status"],
  round = 1,
): Match {
  return {
    id: uid(),
    tournamentId: "cup",
    round,
    homeTeamId: home.id,
    awayTeamId: away.id,
    scheduledAt: new Date(0),
    venue: null,
    homeScore,
    awayScore,
    status,
    photoUrl: null,
    notes: null,
    createdAt: new Date(0),
  };
}

function rowFor(rows: StandingRow[], name: string) {
  const row = rows.find((r) => r.team.name === name);
  if (!row) throw new Error(`no standing row for ${name}`);
  return row;
}

describe("computeStandings", () => {
  it("returns zeroed rows when there are no matches", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], []);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      form: [],
    });
  });

  it("returns an empty table for zero teams", () => {
    expect(computeStandings([], [match(team("X"), team("Y"), 1, 0, "finished")])).toEqual([]);
  });

  it("awards 3 points for a win and 0 for the defeat", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], [match(a, b, 2, 1, "finished")]);

    expect(rowFor(rows, "A")).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 2, goalsAgainst: 1 });
    expect(rowFor(rows, "B")).toMatchObject({ played: 1, lost: 1, points: 0, goalsFor: 1, goalsAgainst: 2 });
  });

  it("awards 1 point each for a draw", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], [match(a, b, 1, 1, "finished")]);

    expect(rowFor(rows, "A").points).toBe(1);
    expect(rowFor(rows, "B").points).toBe(1);
    expect(rowFor(rows, "A").drawn).toBe(1);
  });

  it("computes goal difference as goals for minus goals against", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const rows = computeStandings(
      [a, b, c],
      [match(a, b, 4, 1, "finished"), match(a, c, 0, 0, "finished", 2)],
    );

    expect(rowFor(rows, "A")).toMatchObject({
      played: 2,
      goalsFor: 4,
      goalsAgainst: 1,
      goalDiff: 3,
      points: 4,
    });
  });

  it("ignores matches that are not finished", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings(
      [a, b],
      [match(a, b, 5, 0, "live"), match(a, b, 0, 3, "scheduled", 2)],
    );

    expect(rows.every((r) => r.played === 0)).toBe(true);
    expect(rows.every((r) => r.points === 0)).toBe(true);
  });

  it("ignores finished matches with a null score", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], [match(a, b, null, null, "finished")]);

    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it("tracks form in chronological input order", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const rows = computeStandings(
      [a, b, c],
      [
        match(a, b, 2, 0, "finished", 1),
        match(a, c, 1, 1, "finished", 2),
        match(b, c, 0, 1, "finished", 3),
      ],
    );

    expect(rowFor(rows, "A").form).toEqual(["W", "D"]);
    expect(rowFor(rows, "B").form).toEqual(["L", "L"]);
    expect(rowFor(rows, "C").form).toEqual(["D", "W"]);
  });

  it("breaks a points tie on goal difference", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const rows = computeStandings(
      [a, b, c],
      [
        match(a, b, 1, 0, "finished", 1),
        match(a, c, 1, 0, "finished", 2),
        match(b, c, 1, 0, "finished", 3),
      ],
    );

    expect(rows[0].team.name).toBe("A");
    expect(rows[0].points).toBe(6);
  });

  it("breaks a goal-difference tie on goals scored", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const rows = computeStandings(
      [a, b, c],
      [
        match(a, b, 3, 1, "finished", 1),
        match(a, c, 1, 0, "finished", 2),
        match(b, c, 2, 0, "finished", 3),
      ],
    );

    expect(rows[0].team.name).toBe("A");
    expect(rows[1].team.name).toBe("B");
  });

  it("falls back to alphabetical order when every metric ties", () => {
    const a = team("Alpha");
    const b = team("Beta");
    const c = team("Gamma");
    const rows = computeStandings(
      [a, b, c],
      [
        match(b, c, 1, 0, "finished", 1),
        match(a, c, 1, 0, "finished", 2),
        match(a, b, 1, 0, "finished", 3),
      ],
    );

    expect(rows.map((r) => r.team.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("assigns dense ranks 1..n in table order", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], [match(a, b, 1, 0, "finished")]);

    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("skips a match whose teams are not in the supplied team list", () => {
    const a = team("A");
    const ghost = team("Ghost");
    const rows = computeStandings([a], [match(a, ghost, 3, 0, "finished")]);

    expect(rows).toHaveLength(1);
    expect(rows[0].played).toBe(0);
  });

  it("counts both sides of a fixture for each team", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const rows = computeStandings(
      [a, b, c],
      [
        match(a, b, 1, 1, "finished", 1),
        match(b, a, 2, 1, "finished", 2),
      ],
    );

    expect(rowFor(rows, "A")).toMatchObject({ played: 2, points: 1 });
    expect(rowFor(rows, "B")).toMatchObject({ played: 2, points: 4 });
  });

  it("handles a 0-0 clean sheet with no goals scored", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], [match(a, b, 0, 0, "finished")]);

    expect(rowFor(rows, "A")).toMatchObject({ goalsFor: 0, goalsAgainst: 0, points: 1 });
  });

  it("handles a high-scoring match", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], [match(a, b, 12, 9, "finished")]);

    expect(rowFor(rows, "A")).toMatchObject({ goalsFor: 12, goalDiff: 3, points: 3 });
    expect(rowFor(rows, "B")).toMatchObject({ goalsFor: 9, goalDiff: -3 });
  });
});

describe("tournamentWinner", () => {
  it("returns null when there are no teams", () => {
    expect(tournamentWinner([])).toBeNull();
  });

  it("returns the top of the table", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeStandings([a, b], [match(a, b, 1, 0, "finished")]);

    expect(tournamentWinner(rows)?.team.name).toBe("A");
  });

  it("returns a leader even before any match is played", () => {
    const rows = computeStandings([team("Only")], []);
    expect(tournamentWinner(rows)?.team.name).toBe("Only");
  });
});

describe("roundRobinPairings", () => {
  it("returns nothing for fewer than two teams", () => {
    expect(roundRobinPairings([])).toEqual([]);
    expect(roundRobinPairings(["a"])).toEqual([]);
  });

  it("produces 6 pairings for 4 teams", () => {
    expect(roundRobinPairings(["a", "b", "c", "d"])).toHaveLength(6);
  });

  it("produces n(n-1)/2 pairings for any n", () => {
    for (const n of [2, 3, 4, 5, 6, 8]) {
      const ids = Array.from({ length: n }, (_, i) => `t${i}`);
      expect(roundRobinPairings(ids)).toHaveLength((n * (n - 1)) / 2);
    }
  });

  it("never pairs a team against itself", () => {
    const ids = ["a", "b", "c", "d", "e"];
    for (const [home, away] of roundRobinPairings(ids)) {
      expect(home).not.toBe(away);
    }
  });

  it("pairs every team with every other exactly once", () => {
    const ids = ["a", "b", "c", "d"];
    const seen = new Set<string>();
    for (const [home, away] of roundRobinPairings(ids)) {
      const key = [home, away].sort().join("-");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(6);
  });

  it("works with an odd number of teams using a bye", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const pairs = roundRobinPairings(ids);
    expect(pairs).toHaveLength(10);

    for (const [home, away] of pairs) {
      expect(home).not.toBe(away);
    }
  });

  it("covers every team across the schedule for an odd count", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const covered = new Set(roundRobinPairings(ids).flat());
    for (const id of ids) expect(covered.has(id)).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const ids = ["a", "b", "c", "d"];
    expect(roundRobinPairings(ids)).toEqual(roundRobinPairings(ids));
  });

  it("does not mutate the input array", () => {
    const ids = ["a", "b", "c", "d"];
    roundRobinPairings(ids);
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
});

describe("knockoutPairings", () => {
  it("returns nothing for fewer than two teams", () => {
    expect(knockoutPairings([])).toEqual([]);
    expect(knockoutPairings(["a"])).toEqual([]);
  });

  it("creates a semi-final pair for 4 teams", () => {
    expect(knockoutPairings(["a", "b", "c", "d"])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("pairs every team exactly once for an even count", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const pairs = knockoutPairings(ids);
    expect(pairs).toHaveLength(3);

    const flat = pairs.flat();
    expect(new Set(flat).size).toBe(6);
  });

  it("drops a trailing unpaired team for an odd count", () => {
    expect(knockoutPairings(["a", "b", "c"])).toEqual([["a", "b"]]);
  });
});