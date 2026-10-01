import type { Match, MatchEvent, Team } from "@/lib/db/schema";
import {
  bestAttack,
  bestDefence,
  computePlayerStats,
  computeTeamStats,
  topScorers,
  type PlayerStatRow,
  type TeamStatRow,
} from "@/lib/stats";

let seq = 0;
const uid = (p: string) => `${p}${++seq}`;

function team(name: string): Team {
  return {
    id: uid("team-"),
    tournamentId: "cup",
    name,
    shortName: null,
    captainPlayerId: null,
    managerPlayerId: null,
    seed: seq,
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
  status: Match["status"] = "finished",
): Match {
  return {
    id: uid("match-"),
    tournamentId: "cup",
    round: 1,
    homeTeamId: home.id,
    awayTeamId: away.id,
    scheduledAt: new Date(seq * 1000),
    venue: null,
    homeScore,
    awayScore,
    status,
    photoUrl: null,
    notes: null,
    createdAt: new Date(0),
  };
}

function event(
  matchId: string,
  teamId: string,
  playerId: string,
  type: MatchEvent["type"],
  minute = 10,
): MatchEvent {
  return {
    id: uid("ev-"),
    matchId,
    tournamentId: "cup",
    playerId,
    teamId,
    type,
    minute,
    note: null,
    createdAt: new Date(0),
  };
}

function statFor(rows: TeamStatRow[], name: string): TeamStatRow {
  const row = rows.find((r) => r.team.name === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

function playerFor(rows: PlayerStatRow[], name: string): PlayerStatRow {
  const row = rows.find((r) => r.player.fullName === name);
  if (!row) throw new Error(`no player row for ${name}`);
  return row;
}

describe("computeTeamStats", () => {
  it("zeroes every metric when there are no matches", () => {
    const rows = computeTeamStats([team("A"), team("B")], []);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toMatchObject({
        cleanSheets: 0,
        goalsScored: 0,
        goalsConceded: 0,
        biggestWin: 0,
        winlessStreak: 0,
        yellowCards: 0,
        redCards: 0,
      });
    }
  });

  it("splits goals scored and conceded across both sides", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeTeamStats([a, b], [match(a, b, 3, 1)]);

    expect(statFor(rows, "A")).toMatchObject({ goalsScored: 3, goalsConceded: 1 });
    expect(statFor(rows, "B")).toMatchObject({ goalsScored: 1, goalsConceded: 3 });
  });

  it("counts a clean sheet when the opponent scored none", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeTeamStats([a, b], [match(a, b, 2, 0)]);

    expect(statFor(rows, "A").cleanSheets).toBe(1);
    expect(statFor(rows, "B").cleanSheets).toBe(0);
  });

  it("gives both sides a clean sheet in a goalless draw", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeTeamStats([a, b], [match(a, b, 0, 0)]);

    expect(statFor(rows, "A").cleanSheets).toBe(1);
    expect(statFor(rows, "B").cleanSheets).toBe(1);
  });

  it("ignores matches that are not finished", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeTeamStats([a, b], [match(a, b, 5, 0, "live"), match(a, b, 4, 0, "scheduled")]);

    expect(statFor(rows, "A").goalsScored).toBe(0);
  });

  it("ignores a finished match with a null score", () => {
    const a = team("A");
    const b = team("B");
    const rows = computeTeamStats([a, b], [match(a, b, null, null)]);

    expect(statFor(rows, "A").goalsScored).toBe(0);
  });

  it("records the biggest winning margin and leaves the loser at zero", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const rows = computeTeamStats(
      [a, b, c],
      [match(a, b, 1, 0), match(b, c, 7, 0)],
    );

    expect(statFor(rows, "B").biggestWin).toBe(7);
    expect(statFor(rows, "C").biggestWin).toBe(0);
  });

  it("tracks the longest winless streak per team", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const d = team("D");
    const rows = computeTeamStats(
      [a, b, c, d],
      [
        match(a, b, 2, 0), // A wins
        match(c, a, 1, 0), // A loses
        match(d, a, 1, 1), // A draws -> two in a row without a win
      ],
    );

    expect(statFor(rows, "A").winlessStreak).toBe(2);
  });

  it("resets a winless streak when the team wins again", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const d = team("D");
    const rows = computeTeamStats(
      [a, b, c, d],
      [
        match(c, a, 1, 0),
        match(d, a, 1, 1),
        match(a, b, 5, 0), // win breaks the run
        match(c, a, 2, 0), // a fresh run of one
      ],
    );

    expect(statFor(rows, "A").winlessStreak).toBe(2);
  });

  it("keeps winless streaks independent per team", () => {
    const a = team("A");
    const b = team("B");
    const c = team("C");
    const rows = computeTeamStats(
      [a, b, c],
      [
        match(b, a, 1, 0),
        match(c, a, 1, 1),
        match(b, c, 2, 0),
      ],
    );

    expect(statFor(rows, "A").winlessStreak).toBe(2);
    expect(statFor(rows, "B").winlessStreak).toBe(0);
  });

  it("counts yellow and red cards from finished matches", () => {
    const a = team("A");
    const b = team("B");
    const m = match(a, b, 1, 0);
    const rows = computeTeamStats(
      [a, b],
      [m],
      [
        event(m.id, a.id, "p1", "yellow_card"),
        event(m.id, a.id, "p2", "yellow_card"),
        event(m.id, a.id, "p3", "red_card"),
      ],
    );

    expect(statFor(rows, "A")).toMatchObject({ yellowCards: 2, redCards: 1 });
    expect(statFor(rows, "B")).toMatchObject({ yellowCards: 0, redCards: 0 });
  });

  it("counts a second yellow as a red for the team", () => {
    const a = team("A");
    const b = team("B");
    const m = match(a, b, 1, 0);
    const rows = computeTeamStats([a, b], [m], [event(m.id, a.id, "p1", "second_yellow")]);

    expect(statFor(rows, "A").redCards).toBe(1);
  });

  it("ignores cards from matches that are not finished", () => {
    const a = team("A");
    const b = team("B");
    const live = match(a, b, 1, 0, "live");
    const rows = computeTeamStats([a, b], [live], [event(live.id, a.id, "p1", "yellow_card")]);

    expect(statFor(rows, "A").yellowCards).toBe(0);
  });

  it("ignores cards with no team attached", () => {
    const a = team("A");
    const b = team("B");
    const m = match(a, b, 1, 0);
    const orphan = { ...event(m.id, a.id, "p1", "yellow_card"), teamId: null };
    const rows = computeTeamStats([a, b], [m], [orphan]);

    expect(statFor(rows, "A").yellowCards).toBe(0);
  });
});

describe("bestAttack / bestDefence", () => {
  it("returns null with no teams", () => {
    expect(bestAttack([])).toBeNull();
    expect(bestDefence([])).toBeNull();
  });

  it("picks the highest goals scored", () => {
    const a = team("A");
    const b = team("B");
    // A scores 5 + 2 = 7; B scores 1 + 1 = 2.
    const rows = computeTeamStats([a, b], [match(a, b, 5, 1), match(b, a, 1, 2)]);

    expect(statFor(rows, "A").goalsScored).toBe(7);
    expect(statFor(rows, "B").goalsScored).toBe(2);
    expect(bestAttack(rows)?.team.name).toBe("A");
  });

  it("picks the fewest goals conceded", () => {
    const a = team("A");
    const b = team("B");
    // A concedes 3 + 0 = 3; B concedes 0 + 1 = 1.
    const rows = computeTeamStats([a, b], [match(a, b, 0, 3), match(b, a, 0, 1)]);

    expect(statFor(rows, "B").goalsConceded).toBe(1);
    expect(statFor(rows, "A").goalsConceded).toBe(3);
    expect(bestDefence(rows)?.team.name).toBe("B");
  });
});

describe("computePlayerStats", () => {
  const roster = [
    { id: "p1", fullName: "Ada Nwosu", nickname: "Ada", position: "Forward" },
    { id: "p2", fullName: "Ben Osei", nickname: null, position: "Defender" },
  ];
  const membership = new Map([
    ["p1", "team-a"],
    ["p2", "team-b"],
  ]);
  const teamNames = new Map([
    ["team-a", "Team A"],
    ["team-b", "Team B"],
  ]);

  function run(events: MatchEvent[], finished = ["m1"]) {
    return computePlayerStats({
      players: roster,
      events,
      finishedMatchIds: new Set(finished),
      membership,
      teamNames,
    });
  }

  it("counts a penalty as a goal and flags it as a penalty", () => {
    const rows = run([
      event("m1", "team-a", "p1", "goal", 5),
      event("m1", "team-a", "p1", "penalty_goal", 60),
    ]);

    // A penalty is a goal, so the tally is 2 with 1 of them from the spot.
    expect(playerFor(rows, "Ada Nwosu")).toMatchObject({ goals: 2, penalties: 1 });
  });

  it("counts a player's own goal without crediting them a goal", () => {
    const rows = run([event("m1", "team-a", "p1", "own_goal", 8)]);

    expect(playerFor(rows, "Ada Nwosu")).toMatchObject({ goals: 0, ownGoals: 1 });
  });

  it("allows a player to score more than once", () => {
    const rows = run([
      event("m1", "team-a", "p1", "goal", 5),
      event("m1", "team-a", "p1", "goal", 70),
    ]);

    expect(playerFor(rows, "Ada Nwosu").goals).toBe(2);
  });

  it("tallies yellows, second yellows and reds separately", () => {
    const rows = run([
      event("m1", "team-b", "p2", "yellow_card", 20),
      event("m1", "team-b", "p2", "second_yellow", 70),
      event("m1", "team-b", "p2", "red_card", 80),
    ]);

    // A second yellow is also a dismissal, so redCards counts both.
    expect(playerFor(rows, "Ben Osei")).toMatchObject({
      yellowCards: 1,
      secondYellows: 1,
      redCards: 2,
    });
  });

  it("weights a red higher than a yellow in card points", () => {
    const rows = run([
      event("m1", "team-a", "p1", "yellow_card", 20),
      event("m1", "team-a", "p1", "red_card", 80),
    ]);

    expect(playerFor(rows, "Ada Nwosu").cardPoints).toBeGreaterThan(
      playerFor(rows, "Ben Osei").cardPoints,
    );
  });

  it("ignores events from matches that are not finished", () => {
    const rows = run([event("m2", "team-a", "p1", "goal", 5)], ["m1"]);

    expect(playerFor(rows, "Ada Nwosu").goals).toBe(0);
  });

  it("counts an appearance once per finished match with an event", () => {
    const rows = run([
      event("m1", "team-a", "p1", "goal", 5),
      event("m1", "team-a", "p1", "yellow_card", 60),
    ]);

    expect(playerFor(rows, "Ada Nwosu").appearances).toBe(1);
  });

  it("includes every registered player even with no events", () => {
    const rows = run([]);

    expect(rows).toHaveLength(2);
    expect(playerFor(rows, "Ben Osei").goals).toBe(0);
  });

  it("leaves the team blank for an unassigned player", () => {
    const rows = computePlayerStats({
      players: roster,
      events: [],
      finishedMatchIds: new Set<string>(),
      membership: new Map([["p1", null]]),
      teamNames,
    });

    expect(playerFor(rows, "Ada Nwosu").teamName).toBeNull();
  });
});

describe("topScorers", () => {
  const roster = [
    { id: "p1", fullName: "Ada Nwosu", nickname: null, position: "Forward" },
    { id: "p2", fullName: "Ben Osei", nickname: null, position: "Forward" },
    { id: "p3", fullName: "Cara Lim", nickname: null, position: "Forward" },
  ];
  const membership = new Map([
    ["p1", "team-a"],
    ["p2", "team-a"],
    ["p3", "team-b"],
  ]);
  const teamNames = new Map([
    ["team-a", "Team A"],
    ["team-b", "Team B"],
  ]);

  function run(events: MatchEvent[]) {
    return topScorers(
      computePlayerStats({
        players: roster,
        events,
        finishedMatchIds: new Set(["m1"]),
        membership,
        teamNames,
      }),
    );
  }

  it("returns an empty ladder with no players", () => {
    expect(topScorers([])).toEqual([]);
  });

  it("excludes players who have not scored", () => {
    const rows = run([
      event("m1", "team-a", "p1", "goal", 5),
      event("m1", "team-a", "p2", "yellow_card", 30),
    ]);

    expect(rows.map((r) => r.player.fullName)).toEqual(["Ada Nwosu"]);
  });

  it("ranks the higher tally first", () => {
    const rows = run([
      event("m1", "team-a", "p1", "goal", 5),
      event("m1", "team-a", "p2", "goal", 10),
      event("m1", "team-a", "p2", "goal", 20),
    ]);

    expect(rows[0].player.fullName).toBe("Ben Osei");
    expect(rows[0].rank).toBe(1);
  });

  it("counts penalty goals toward the tally", () => {
    const rows = run([event("m1", "team-b", "p3", "penalty_goal", 80)]);

    expect(rows[0]).toMatchObject({ goals: 1, penalties: 1 });
  });

  it("does not count an own goal toward a player's tally", () => {
    const rows = run([event("m1", "team-b", "p3", "own_goal", 30)]);

    expect(rows).toEqual([]);
  });

  it("breaks a scoring tie alphabetically", () => {
    const rows = run([
      event("m1", "team-a", "p1", "goal", 5),
      event("m1", "team-a", "p2", "goal", 6),
    ]);

    expect(rows.map((r) => r.player.fullName)).toEqual(["Ada Nwosu", "Ben Osei"]);
  });

  it("truncates to the limit but keeps real ranks", () => {
    const rows = run([
      event("m1", "team-a", "p1", "goal", 5),
      event("m1", "team-a", "p2", "goal", 6),
      event("m1", "team-b", "p3", "goal", 7),
    ]);

    const limited = topScorers(rows, 2);
    expect(limited).toHaveLength(2);
    expect(limited.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("caps at ten by default", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      id: `x${i}`,
      fullName: `Player ${String(i).padStart(2, "0")}`,
      nickname: null,
      position: "Forward" as const,
    }));
    const events = many.map((p, i) => event("m1", "team-a", p.id, "goal", i + 1));
    const rows = computePlayerStats({
      players: many,
      events,
      finishedMatchIds: new Set(["m1"]),
      membership: new Map(many.map((p) => [p.id, "team-a"])),
      teamNames: new Map([["team-a", "Team A"]]),
    });

    expect(topScorers(rows)).toHaveLength(10);
  });
});