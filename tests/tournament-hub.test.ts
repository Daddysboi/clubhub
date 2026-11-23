import { readFileSync } from "node:fs";

/**
 * Structure guards for the public tournament hub. The page used to repeat
 * teams, fixtures and the Golden Boot in two or three places; these checks
 * keep the single-source layout from drifting back.
 */
const source = readFileSync("app/tournaments/[slug]/page.tsx", "utf8");
const count = (needle: string) => source.split(needle).length - 1;
const sections = ["memories", "fixtures", "standings", "stats", "squads"] as const;

describe("public tournament hub", () => {
  it.each(sections)("renders exactly one %s section", (id) => {
    expect(count(`id="${id}"`)).toBe(1);
  });

  it("links every section from the sticky rail", () => {
    expect(source).toContain("href={`#${item.id}`}");
    for (const id of sections) {
      expect(source).toContain(`id: "${id}"`);
    }
  });

  it("does not bring back the duplicated headings", () => {
    expect(source).not.toContain("Match schedule");
    expect(source).not.toContain('title="Golden Boot"');
    expect(source).not.toContain('title="Teams"');
    expect(source).toContain("Top scorers");
  });

  it("keeps long squad lists behind a native disclosure", () => {
    expect(source).toContain("<details");
    expect(source).toContain("<summary");
  });

  it("shows the configured competition format in the hero", () => {
    expect(source).toContain("formatLabel, stageLabel, stageOrder");
    expect(source).toContain("{formatLabel(tournament.format)}");
  });

  it("does not crash on a tournament with no scorers yet", () => {
    expect(source).toContain("groupTopScorers(stats.scorers)[0] ?? []");
  });

  it("folds match events into the score card instead of a second block", () => {
    expect(source).toContain("events={(eventMap.get(m.id) ?? []).map");
    expect(source).not.toMatch(/<ScorerBoard[\s\S]*?compact/);
  });

  it("drops the duplicated team-stat tile row", () => {
    expect(source).not.toContain("MicroStat");
    expect(source).not.toContain("label=\"CS\"");
  });
});

describe("league table", () => {
  const table = readFileSync("components/StandingsTable.tsx", "utf8");

  it("shows the full record — no combined W-D-L shorthand", () => {
    expect(table).not.toContain("W-D-L");
    for (const column of ["P", "W", "D", "L", "GF", "GA", "GD"]) {
      expect(table).toContain(`label="${column}"`);
    }
    expect(table).toContain(">\n                Pts\n");
    expect(table).toContain(">\n                Form\n");
    expect(table).toContain('title="Played"');
    expect(table).toContain('title="Won"');
  });

  it("keeps every column readable without an x-axis scrollbar", () => {
    expect(table).not.toContain("overflow-x-auto");
    expect(table).toContain("md:hidden"); // stacked rows carry the same data on phones
    expect(table).toContain("hidden md:block"); // full table once there is room
    expect(table).toContain("grid-cols-7");
  });

  it("uses the team's full name so the crest code is not repeated", () => {
    expect(table).toContain("{row.team.name}");
    expect(table).not.toContain("row.team.shortName");
  });
});

describe("swipeable results", () => {
  const rail = readFileSync("components/MatchRail.tsx", "utf8");

  it("snaps each round's cards into a horizontal rail", () => {
    expect(rail).toContain("snap-x snap-mandatory");
    expect(rail).toContain("no-scrollbar -mx-1 flex");
    expect(source).toContain("snap-start");
  });

  it("peeks 1.5 cards on phones and 2.5–3.5 on larger screens", () => {
    expect(source).toContain('w-[66%] shrink-0 snap-start sm:w-[40%] lg:w-[28.5%]');
  });

  it("is operable with a keyboard, not just a touch swipe", () => {
    expect(rail).toContain('role="region"');
    expect(rail).toContain("tabIndex={0}");
    expect(rail).toContain("aria-label={`${title} fixtures`}");
    expect(rail).toContain('aria-label={`Scroll ${title} left`}');
    expect(rail).toContain('aria-label={`Scroll ${title} right`}');
  });

  it("gives the table its own full-width section, not a narrow sidebar", () => {
    expect(source).not.toContain('id="standings" className="scroll-mt-32 lg:sticky');
    expect(source).toContain('id="standings" className="mt-9 scroll-mt-32"');
    expect(source).not.toContain("lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]");
  });

  it("groups fixtures by stage, with stage names from the tournament format", () => {
    expect(source).toContain("{stageLabel(stage, round, tournament.format)}");
    expect(source).toContain("stageOrder(a.stage) - stageOrder(b.stage)");
  });

  it("keeps the full-time badge on one line in narrow cards", () => {
    const card = readFileSync("components/MatchCard.tsx", "utf8");
    expect(card).toContain('<abbr title="Full time"');
    expect(card).toContain("shrink-0 whitespace-nowrap px-1.5 text-[10px]");
    expect(card).not.toContain("Round {match.round}");
  });
});

describe("roster labels", () => {
  it("does not repeat the team name inside each grouped squad", () => {
    const row = readFileSync("components/PlayerRow.tsx", "utf8");
    expect(row).not.toContain("Unassigned");
  });
});

describe("competition format controls", () => {
  const newTournament = readFileSync("components/admin/NewTournamentForm.tsx", "utf8");
  const settings = readFileSync("components/admin/AdminTournamentSettings.tsx", "utf8");
  const fixtures = readFileSync("components/admin/AdminFixtures.tsx", "utf8");
  const actions = readFileSync("app/actions/admin.ts", "utf8");
  const sql = readFileSync("supabase/schema.sql", "utf8");

  it("lets an organiser pick a format when creating and editing a cup", () => {
    expect(newTournament).toContain('<Select id="format" name="format" defaultValue="league">');
    expect(settings).toContain(
      '<Select id="tFormat" name="format" defaultValue={tournament.format ?? "league"}>',
    );
    expect(actions).toContain('format: String(formData.get("format") ?? "league")');
  });

  it("saves stage per fixture, without assuming every cup has a final", () => {
    expect(fixtures).toContain('name="stage"');
    expect(fixtures).toContain("canHaveFinal && !hasFinal");
    expect(fixtures).toContain('tournament.format === "tri_series"');
    expect(actions).toContain("export async function createFinal(");
    expect(actions).toContain("computeStandings(");
  });

  it("offers every stored stage and derives labels from the format", () => {
    expect(fixtures).toContain("MATCH_STAGES");
    expect(fixtures).toContain("stageLabel(stage, 1, format)");
    expect(fixtures).toContain("<StageOptions");
    expect(fixtures).not.toContain("<option value=\"semi\">");
  });

  it("persists all four stages and all three formats in the database", () => {
    expect(sql).toContain("check (format in ('league','tri_series','knockout'))");
    expect(sql).toContain("stage in ('group','quarter','semi','final')");
  });
});

describe("photo gallery slider", () => {
  const gallery = readFileSync("components/MemoryGallery.tsx", "utf8");
  const home = readFileSync("app/page.tsx", "utf8");

  it("keeps the album a compact horizontal band, not a tall masonry grid", () => {
    expect(gallery).toContain("no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto");
    expect(gallery).not.toContain("columns-2 gap-3 sm:columns-3 lg:columns-4");
    expect(gallery).toContain("w-[70%] shrink-0 snap-start overflow-hidden");
    expect(gallery).toContain("sm:w-[46%] lg:w-[31%]");
    expect(gallery).toContain("h-44 w-full object-cover");
  });

  it("is keyboard operable with a labelled region and reduced-motion aware controls", () => {
    expect(gallery).toContain('role="region"');
    expect(gallery).toContain('aria-label="Tournament memories"');
    expect(gallery).toContain("tabIndex={0}");
    expect(gallery).toContain('aria-label="Scroll memories left"');
    expect(gallery).toContain('aria-label="Scroll memories right"');
    expect(gallery).toContain("function scrollRail(");
    expect(gallery).toContain("prefers-reduced-motion: reduce");
  });

  it("previews up to three photos on the home page, deep-linked into the album", () => {
    expect(home).toContain("getTournamentMemories(featured.id)");
    expect(home).toContain("memories.slice(0, 3)");
    expect(home).toContain("?photo=${photo.id}");
    expect(home).toContain("#memories");
  });
});

describe("hub accessibility", () => {
  it("uses links styled as buttons instead of nesting buttons in links", () => {
    expect(source).not.toContain("<Button");
    expect(source).toContain('className={buttonVariants()}');
    expect(source).toContain('buttonVariants({ variant: "secondary" })');
  });

  it("lists every tied team for a shared record, each with its own value", () => {
    expect(source).toContain('<dd className="mt-1.5">');
    expect(source).toContain('<ul className="space-y-1.5">');
    expect(source).toContain("{names.map((name) => (");
    expect(source).toContain('names={bestAttackTeams.map((t) => t.team.name)}');
    expect(source).toContain('names={bestDefenceTeams.map((t) => t.team.name)}');
  });

  it("gives every confirmation dialog its own title id", () => {
    const dialog = readFileSync("components/ui/confirm-dialog.tsx", "utf8");
    expect(dialog).toContain("useId()");
    expect(dialog).not.toContain('id="confirm-dialog-title"');
  });

  it("keeps arrow keys out of the comment fields in the lightbox", () => {
    const gallery = readFileSync("components/MemoryGallery.tsx", "utf8");
    expect(gallery).toContain('[contenteditable=\'true\']');
    expect(gallery).toContain("event.shiftKey");
    expect(gallery).toContain("aria-live=\"polite\"");
  });
});
