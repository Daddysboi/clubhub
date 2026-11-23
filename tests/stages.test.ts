import { FORMATS, formatLabel, isMatchStage, stageLabel, stageOrder } from "@/lib/stages";

describe("match stages", () => {
  it("labels knockout stages independently of round numbers", () => {
    expect(stageLabel("quarter", 3, "knockout")).toBe("Quarter-final");
    expect(stageLabel("semi", 4, "knockout")).toBe("Semi-final");
    expect(stageLabel("final", 9, "knockout")).toBe("Final");
  });

  it("names group rounds according to the competition format", () => {
    expect(stageLabel("group", 1, "league")).toBe("Round 1");
    expect(stageLabel("group", 1, "tri_series")).toBe("Group stage · Round 1");
    expect(stageLabel("group", 2, "knockout")).toBe("Round 2");
  });

  it("orders group games before the knockout rounds", () => {
    expect(stageOrder("group")).toBeLessThan(stageOrder("quarter"));
    expect(stageOrder("quarter")).toBeLessThan(stageOrder("semi"));
    expect(stageOrder("semi")).toBeLessThan(stageOrder("final"));
    expect(stageOrder(null)).toBe(stageOrder("group"));
  });

  it("validates stage values", () => {
    expect(isMatchStage("group")).toBe(true);
    expect(isMatchStage("final")).toBe(true);
    expect(isMatchStage("quarter")).toBe(true);
    expect(isMatchStage("round 1")).toBe(false);
    expect(isMatchStage(null)).toBe(false);
  });
});

describe("competition formats", () => {
  it("does not assume a final exists", () => {
    expect(FORMATS.league.hasKnockout).toBe(false);
    expect(FORMATS.tri_series.hasKnockout).toBe(true);
    expect(FORMATS.knockout.hasGroups).toBe(false);
  });

  it("has a readable label for every format, including unknown legacy values", () => {
    expect(formatLabel("tri_series")).toBe("Tri-series");
    expect(formatLabel("league")).toBe("League");
    expect(formatLabel(null)).toBe("League");
  });
});
