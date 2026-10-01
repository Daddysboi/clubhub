import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Player visibility contract.
 *
 * Two rules pull in opposite directions and both are load-bearing:
 *
 *   1. The public roster must only list players who are actually in a squad.
 *      `/join` is open, so a left join published every name anyone typed.
 *   2. The admin directory must list every player, including those in no squad
 *      and those in no competition at all — otherwise there is no screen
 *      anywhere to delete them from.
 *
 * Asserted at the source level, like the tournament delete contract, because
 * `queries.ts` is `server-only` and needs a live database to import.
 */

const queries = readFileSync("lib/db/queries.ts", "utf8");
const playerActions = readFileSync("app/actions/players.ts", "utf8");
const adminPage = readFileSync("app/admin/page.tsx", "utf8");
const allPlayers = readFileSync("components/admin/AdminAllPlayers.tsx", "utf8");
const signupForm = readFileSync("components/SignupForm.tsx", "utf8");
const playersPage = readFileSync("app/players/page.tsx", "utf8");

/** Body of `export async function <name>(` up to the next top-level export. */
function fnBody(name: string): string {
  const start = queries.indexOf(`export async function ${name}(`);
  if (start === -1) return "";
  const next = queries.indexOf("\nexport ", start + 1);
  return queries.slice(start, next === -1 ? queries.length : next);
}

describe("public roster excludes players outside a squad", () => {
  for (const name of ["getPublicPlayers", "searchPlayers"]) {
    it(`${name} inner joins the squad table`, () => {
      // A left join here lists every open-signup submission on a public page.
      expect(fnBody(name)).toMatch(/\.innerJoin\(teamPlayers/);
      expect(fnBody(name)).not.toMatch(/\.leftJoin\(teamPlayers/);
    });

    it(`${name} never selects phone`, () => {
      expect(fnBody(name)).not.toMatch(/\bphone:/);
    });
  }
});

describe("admin player directory is complete", () => {
  it("lists every player across all competitions", () => {
    expect(fnBody("listAllPlayersForAdmin")).toMatch(/\.from\(players\)/);
  });

  it("keeps players with no squad", () => {
    // Left join, or these players vanish from the only screen that can delete
    // them.
    expect(fnBody("listAllPlayersForAdmin")).toMatch(/\.leftJoin\(teamPlayers/);
  });

  it("keeps players with no competition", () => {
    expect(fnBody("listAllPlayersForAdmin")).toMatch(/\.leftJoin\(tournaments/);
  });

  it("does select phone, since admin is trusted", () => {
    expect(fnBody("listAllPlayersForAdmin")).toMatch(/\bphone:/);
  });

  it("labels the groups a player can be missing from", () => {
    expect(allPlayers).toMatch(/Unassigned/);
    expect(allPlayers).toMatch(/No competition/);
  });

  it("is mounted on the admin panel", () => {
    expect(adminPage).toMatch(/<AdminAllPlayers/);
    expect(adminPage).toMatch(/listAllPlayersForAdmin/);
  });
});

describe("deletePlayer refreshes every page that shows a player", () => {
  it("goes through refresh rather than revalidating /admin only", () => {
    // A standalone player has no tournament slug to revalidate, so refresh()
    // is what covers the public roster.
    const body = playerActions.slice(playerActions.indexOf("export async function deletePlayer("));
    expect(body).toMatch(/refresh\(existing\[0\]\.tournamentId\)/);
  });

  it("reports honestly when the row is already gone", () => {
    expect(playerActions).toMatch(/Player not found/);
  });
});

describe("signup confirmation matches what is actually public", () => {
  it("does not claim the name is already on the players list", () => {
    // Only squad players are published, so this claim was false on arrival.
    expect(signupForm).not.toMatch(/now on the players list/);
  });

  it("says publication waits until the player joins a squad", () => {
    expect(signupForm).toMatch(/not published until you join a squad/);
  });

  it("still reassures about the phone number", () => {
    expect(signupForm).toMatch(/organiser only|never shown publicly|never displayed/);
  });
});

describe("players page toolbar", () => {
  it("keeps search and its submit button in one row", () => {
    // flex-wrap on the form dropped the button below the fold on a phone.
    expect(playersPage).toMatch(/<PlayersFilters/);
    expect(playersPage).not.toMatch(/flex-wrap gap-2/);
  });

  it("hides the competition filter behind a toggle", () => {
    expect(readFileSync("components/PlayersFilters.tsx", "utf8")).toMatch(/aria-controls="player-filters"/);
  });
});