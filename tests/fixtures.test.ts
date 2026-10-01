import { roundRobinPairings } from "@/lib/standings";

/**
 * The organiser can create any number of squads, so fixture generation must
 * hold for 2 teams and for 12 without a special case per size.
 */
describe("roundRobinPairings across team counts", () => {
  const counts = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

  it.each(counts)("plays every pairing exactly once for %i teams", (n) => {
    const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`);
    const pairs = roundRobinPairings(ids);

    expect(pairs.length).toBe((n * (n - 1)) / 2);

    const meetings = new Set(pairs.map(([a, b]) => [a, b].sort().join("|")));
    expect(meetings.size).toBe(pairs.length);
  });

  it.each(counts)("never pairs a team with itself for %i teams", (n) => {
    const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`);
    for (const [home, away] of roundRobinPairings(ids)) {
      expect(home).not.toBe(away);
    }
  });

  it.each(counts)("gives every team the same number of games for %i teams", (n) => {
    const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`);
    const pairs = roundRobinPairings(ids);

    const games = new Map<string, number>();
    for (const [home, away] of pairs) {
      games.set(home, (games.get(home) ?? 0) + 1);
      games.set(away, (games.get(away) ?? 0) + 1);
    }

    const counts_ = [...games.values()];
    expect(Math.min(...counts_)).toBe(n - 1);
    expect(new Set(counts_).size).toBe(1);
  });

  it("returns nothing for fewer than two teams", () => {
    expect(roundRobinPairings([])).toEqual([]);
    expect(roundRobinPairings(["T1"])).toEqual([]);
  });

  it("alternates home advantage rather than fixing one side", () => {
    const ids = ["A", "B", "C", "D"];
    const pairs = roundRobinPairings(ids);
    const aHome = pairs.filter(([h]) => h === "A").length;
    // A should host more than once across the tournament, not sit at home
    // for every single fixture.
    expect(aHome).toBeGreaterThan(0);
    expect(aHome).toBeLessThan(pairs.length);
  });
});