import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The delete-a-tournament contract, asserted at the source level.
 *
 * scripts/test-delete-cascade.ts proves the behaviour against a live database,
 * but that needs credentials and is not part of `npm test`. These checks are the
 * free half: they fail the moment someone loosens a rule the UI depends on, with
 * no database in sight.
 *
 * Read as text rather than by importing, because the action module pulls in
 * `server-only` and a live database client.
 */

const schema = readFileSync("supabase/schema.sql", "utf8");
const adminActions = readFileSync("app/actions/admin.ts", "utf8");
const listPage = readFileSync("app/admin/page.tsx", "utf8");
const confirmDialog = readFileSync("components/ui/confirm-dialog.tsx", "utf8");

/** The body of `create table ... public.<table> ( ... );`, if present. */
function createTableBlock(table: string): string {
  const re = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i");
  return schema.match(re)?.[1] ?? "";
}

/**
 * The ON DELETE rule for a foreign key on `column`.
 *
 * Foreign keys appear two ways in this schema: inline in the create table, or as
 * a later `add constraint ... foreign key (col)`. Both are matched so the test
 * covers deferred constraints as well as the original definitions.
 */
function ruleFor(table: string, column: string): string | undefined {
  const inline = createTableBlock(table).match(
    new RegExp(
      `${column}\\b[^,]*?references\\s+public\\.\\w+\\(id\\)\\s+on delete\\s+(set null|set default|cascade|restrict|no action)`,
      "is",
    ),
  );
  if (inline) return inline[1].toLowerCase();

  const deferred = schema.match(
    new RegExp(
      `foreign key\\s*\\(\\s*${column}\\s*\\)[^;]*?on delete\\s+(set null|set default|cascade|restrict|no action)`,
      "is",
    ),
  );
  return deferred?.[1]?.toLowerCase();
}

describe("tournament deletion cascade rules", () => {
  it("deletes teams with the tournament", () => {
    expect(ruleFor("teams", "tournament_id")).toBe("cascade");
  });

  it("deletes matches with the tournament", () => {
    expect(ruleFor("matches", "tournament_id")).toBe("cascade");
  });

  it("deletes match events with the tournament", () => {
    expect(ruleFor("match_events", "tournament_id")).toBe("cascade");
  });

  it("releases players instead of destroying them", () => {
    // A player is a person, not competition data. Cascading here would delete
    // real people because an organiser tidied up an old tournament.
    expect(ruleFor("players", "tournament_id")).toBe("set null");
  });

  it("clears a champion whose team is being cascaded away", () => {
    expect(ruleFor("tournaments", "winner_team_id")).toBe("set null");
  });
});

describe("deleteTournament action", () => {
  it("is exported for the organiser panel", () => {
    expect(adminActions).toMatch(/export async function deleteTournament\(/);
  });

  it("authorises before deleting", () => {
    const body = adminActions.slice(adminActions.indexOf("export async function deleteTournament("));
    expect(body.indexOf("requireAdmin()")).toBeGreaterThan(-1);
    expect(body.indexOf("requireAdmin()")).toBeLessThan(body.indexOf("db.delete(tournaments)"));
  });

  it("reports honestly when the tournament is already gone", () => {
    // Guards a double submit or a stale tab from claiming a success it did not do.
    expect(adminActions).toMatch(/no longer exists/);
  });

  it("revalidates the deleted tournament's own panel", () => {
    // /admin alone does not cover /admin/tournaments/[id]; without this the
    // deleted tournament keeps rendering on its detail page.
    const body = adminActions.slice(adminActions.indexOf("export async function deleteTournament("));
    expect(body).toMatch(/refresh\(id\)/);
  });
});

describe("tournament list offers a delete control", () => {
  it("renders a delete button per row", () => {
    expect(listPage).toMatch(/<AdminDeleteTournament/);
  });

  it("offers it on both the desktop table and the mobile cards", () => {
    const uses = listPage.match(/<AdminDeleteTournament/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
  });

  it("does not nest the delete button inside the row link", () => {
    // A <button> inside an <a> is invalid HTML and the tap targets fight.
    const mobileBlock = listPage.slice(listPage.indexOf("sm:hidden"));
    const anchor = mobileBlock.slice(mobileBlock.indexOf("<Link"), mobileBlock.indexOf("</Link>"));
    expect(anchor).not.toMatch(/AdminDeleteTournament/);
  });
});

describe("confirm dialog text alignment", () => {
  it("pins the dialog to text-left", () => {
    // The dialog renders in place in the DOM, so it inherits text-align from its
    // trigger. The trigger sits in a text-right table cell, which dragged the
    // body copy right with it.
    expect(confirmDialog).toMatch(/text-left/);
  });

  it("keeps the footer buttons right-aligned regardless", () => {
    expect(confirmDialog).toMatch(/justify-end/);
  });
});

describe("admin tab strip", () => {
  it("no longer carries an unused leading slot", () => {
    expect(listPage).not.toMatch(/Organiser panel/);
  });
});