import {
  eventSchema,
  signupSchema,
  teamSchema,
  tournamentSchema,
  matchSchema,
  scoreSchema,
} from "@/lib/validation";

const tournamentId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const matchId = "33333333-3333-4333-8333-333333333333";

function firstFieldError(result: {
  success: boolean;
  error?: { flatten(): { fieldErrors: Record<string, string[] | undefined> } };
}) {
  if (result.success || !result.error) return null;
  const { fieldErrors } = result.error.flatten();
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) return field;
  }
  return "unknown";
}

describe("signupSchema", () => {
  const base = {
    tournamentId,
    fullName: "Ada Nwosu",
    nickname: "Ada",
    phone: "08012345678",
    position: "Forward" as const,
  };

  it("accepts a complete registration", () => {
    expect(signupSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty full name", () => {
    expect(firstFieldError(signupSchema.safeParse({ ...base, fullName: "  " }))).toBe("fullName");
  });

  it("rejects an unknown position", () => {
    expect(firstFieldError(signupSchema.safeParse({ ...base, position: "Striker" }))).toBe(
      "position",
    );
  });

  it("accepts a standalone registration with no tournament", () => {
    const result = signupSchema.safeParse({
      tournamentId: "",
      fullName: "Ada Nwosu",
      position: "Midfielder",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid tournament id", () => {
    expect(signupSchema.safeParse({ ...base, tournamentId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a name longer than 80 characters", () => {
    expect(signupSchema.safeParse({ ...base, fullName: "a".repeat(81) }).success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    expect(firstFieldError(signupSchema.safeParse({ ...base, phone: "call me" }))).toBe("phone");
  });

  it("rejects a non-url photo", () => {
    expect(signupSchema.safeParse({ ...base, photoUrl: "not-a-url" }).success).toBe(false);
  });

  it("trims surrounding whitespace from the name", () => {
    const result = signupSchema.safeParse({ ...base, fullName: "  Ada Nwosu  " });
    expect(result.success && result.data.fullName).toBe("Ada Nwosu");
  });
});

describe("tournamentSchema", () => {
  it("requires a slug of lowercase letters, numbers and dashes", () => {
    expect(tournamentSchema.safeParse({
      slug: "mastic-end-of-year",
      name: "Mastic Cup",
      status: "draft",
    }).success).toBe(true);

    expect(tournamentSchema.safeParse({
      slug: "Mastic Cup!",
      name: "Mastic Cup",
      status: "draft",
    }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(tournamentSchema.safeParse({ slug: "cup", name: "Cup", status: "finished" }).success).toBe(
      false,
    );
  });

  it("treats club name as optional and trims it", () => {
    expect(tournamentSchema.safeParse({ slug: "cup", name: "Cup", status: "live" }).success).toBe(true);

    const parsed = tournamentSchema.safeParse({
      slug: "cup",
      name: "Cup",
      status: "live",
      clubName: "  Mastic FC  ",
    });
    expect(parsed.success && parsed.data.clubName).toBe("Mastic FC");

    expect(
      tournamentSchema.safeParse({ slug: "cup", name: "Cup", status: "live", clubName: "" }).success,
    ).toBe(true);

    expect(
      tournamentSchema.safeParse({ slug: "cup", name: "Cup", status: "live", clubName: "x".repeat(81) })
        .success,
    ).toBe(false);
  });
});

describe("teamSchema", () => {
  const base = { tournamentId, name: "Team 1" };

  it("accepts a bare team name", () => {
    expect(teamSchema.safeParse(base).success).toBe(true);
  });

  it("accepts squad identity fields", () => {
    const result = teamSchema.safeParse({
      ...base,
      shortName: "T1",
      primaryColor: "#16a34a",
      secondaryColor: "#052e16",
      captainPlayerId: teamId,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short code longer than four characters", () => {
    expect(teamSchema.safeParse({ ...base, shortName: "TEAMONE" }).success).toBe(false);
  });

  it("rejects a short code with punctuation", () => {
    expect(teamSchema.safeParse({ ...base, shortName: "T-1" }).success).toBe(false);
  });

  it("rejects a colour that is not six-digit hex", () => {
    expect(teamSchema.safeParse({ ...base, primaryColor: "green" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...base, primaryColor: "#16a3" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...base, primaryColor: "#16a34a" }).success).toBe(true);
  });

  it("rejects an empty captain uuid", () => {
    expect(teamSchema.safeParse({ ...base, captainPlayerId: "" }).success).toBe(true);
  });

  it("rejects a non-uuid captain id", () => {
    expect(teamSchema.safeParse({ ...base, captainPlayerId: "abc" }).success).toBe(false);
  });

  it("rejects an empty team name", () => {
    expect(teamSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });
});

describe("matchSchema", () => {
  it("requires both teams", () => {
    const result = matchSchema.safeParse({
      tournamentId,
      homeTeamId: teamId,
      awayTeamId: "",
    });
    expect(result.success).toBe(false);
    expect(firstFieldError(result)).toBe("awayTeamId");
  });

  it("defaults the round to one", () => {
    const result = matchSchema.safeParse({
      tournamentId,
      homeTeamId: teamId,
      awayTeamId: matchId,
    });
    expect(result.success && result.data.round).toBe(1);
  });
});

describe("scoreSchema", () => {
  const base = { matchId, status: "finished" as const };

  it("accepts a finished scoreline", () => {
    expect(scoreSchema.safeParse({ ...base, homeScore: "2", awayScore: "1" }).success).toBe(true);
  });

  it("coerces string scores to numbers", () => {
    const result = scoreSchema.safeParse({ ...base, homeScore: "2", awayScore: "1" });
    expect(result.success && result.data.homeScore).toBe(2);
  });

  it("rejects a negative score", () => {
    expect(scoreSchema.safeParse({ ...base, homeScore: "-1", awayScore: "1" }).success).toBe(false);
  });

  it("rejects a non-numeric score", () => {
    expect(scoreSchema.safeParse({ ...base, homeScore: "two", awayScore: "1" }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(scoreSchema.safeParse({ ...base, status: "postponed", homeScore: 0, awayScore: 0 }).success).toBe(
      false,
    );
  });
});

describe("eventSchema", () => {
  const base = { matchId, playerId: teamId, teamId, type: "goal" as const };

  it("accepts a goal with a minute and converts it to a number", () => {
    const result = eventSchema.safeParse({ ...base, minute: "45" });
    expect(result.success && result.data.minute).toBe(45);
  });

  it("converts an empty minute to null", () => {
    const result = eventSchema.safeParse({ ...base, minute: "" });
    expect(result.success && result.data.minute).toBeNull();
  });

  it("accepts an event with no minute at all", () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    expect(firstFieldError(eventSchema.safeParse({ ...base, type: "hat_trick" }))).toBe("type");
  });

  it("rejects a negative minute", () => {
    expect(eventSchema.safeParse({ ...base, minute: "-5" }).success).toBe(false);
  });

  it("rejects a minute past 130", () => {
    expect(eventSchema.safeParse({ ...base, minute: "131" }).success).toBe(false);
  });

  it("requires a player and a team", () => {
    expect(eventSchema.safeParse({ ...base, playerId: "" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, teamId: "" }).success).toBe(false);
  });

  it("accepts every declared event type", () => {
    for (const type of [
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
    ] as const) {
      expect(eventSchema.safeParse({ ...base, type }).success).toBe(true);
    }
  });
});