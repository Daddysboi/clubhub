import { teamCode, type Player, type Team } from "@/lib/db/schema";

function team(over: Partial<Team> = {}): Team {
  return {
    id: "team-1",
    tournamentId: "cup-1",
    name: "Team 1",
    shortName: null,
    captainPlayerId: null,
    managerPlayerId: null,
    seed: 1,
    color: "#16a34a",
    primaryColor: "#16a34a",
    secondaryColor: "#0f172a",
    logoUrl: null,
    createdAt: new Date(0),
    ...over,
  };
}

describe("teamCode", () => {
  it("prefers the explicit short code, uppercased", () => {
    expect(teamCode(team({ shortName: "t2" }))).toBe("T2");
  });

  it("caps a long short code at four characters", () => {
    expect(teamCode(team({ shortName: "sharks" }))).toBe("SHAR");
  });

  it("trims surrounding whitespace on the short code", () => {
    expect(teamCode(team({ shortName: "  pan  " }))).toBe("PAN");
  });

  it("derives the code from a numbered squad name", () => {
    expect(teamCode(team({ name: "Team 3", shortName: null }))).toBe("T3");
  });

  it("takes initials from a multi-word team name", () => {
    expect(teamCode(team({ name: "Real Madrid", shortName: null }))).toBe("RM");
  });

  it("falls back to the name for a single unnumbered word", () => {
    expect(teamCode(team({ name: "Rovers", shortName: null }))).toBe("ROV");
  });

  it("prefers the short code over the name", () => {
    expect(teamCode(team({ name: "Team 4", shortName: "FLC" }))).toBe("FLC");
  });

  it("returns an empty-safe code for a name with no alphanumerics", () => {
    expect(teamCode(team({ name: "!!!", shortName: null }))).toBe("");
  });
});

describe("captain invariants", () => {
  it("keeps a captain reference alongside the player row it points at", () => {
    const captain: Player = {
      id: "p1",
      tournamentId: "cup-1",
      fullName: "Ada Nwosu",
      nickname: "Captain Ada",
      phone: null,
      position: "Defender",
      photoUrl: null,
      createdAt: new Date(0),
    };
    const t = team({ captainPlayerId: captain.id });

    expect(t.captainPlayerId).toBe(captain.id);
  });

  it("allows a team with no captain", () => {
    expect(team().captainPlayerId).toBeNull();
  });
});