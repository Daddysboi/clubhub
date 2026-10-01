/**
 * Proves that deleting a tournament removes every row that hangs off it,
 * inside a rolled-back transaction so live data is never touched.
 *
 * Run with: npx tsx scripts/test-delete-cascade.ts
 * Exits non-zero if any cascade rule is wrong.
 */

/** Reads DATABASE_URL from the environment only — never hardcoded. */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }
  return url;
}

async function main() {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl(), { prepare: false, connect_timeout: 15, max: 1 });

  await sql.begin(async (tx) => {
    const [t] = await tx`
      insert into public.tournaments (slug, name, status)
      values ('cascade-probe', 'Cascade Probe', 'live')
      returning id
    `;
    const tid = t.id;

    const [teamA] = await tx`
      insert into public.teams (tournament_id, name) values (${tid}, 'Probe A') returning id
    `;
    const [teamB] = await tx`
      insert into public.teams (tournament_id, name) values (${tid}, 'Probe B') returning id
    `;

    const [pA] = await tx`
      insert into public.players (tournament_id, full_name)
      values (${tid}, 'Probe Player A') returning id
    `;
    const [pB] = await tx`
      insert into public.players (tournament_id, full_name)
      values (${tid}, 'Probe Player B') returning id
    `;

    await tx`update public.teams set captain_player_id = ${pA.id} where id = ${teamA.id}`;
    await tx`update public.teams set manager_player_id = ${pB.id} where id = ${teamB.id}`;
    await tx`
      insert into public.team_players (team_id, player_id) values (${teamA.id}, ${pA.id})
    `;
    await tx`
      insert into public.team_players (team_id, player_id) values (${teamB.id}, ${pB.id})
    `;

    const [m] = await tx`
      insert into public.matches (tournament_id, home_team_id, away_team_id, status)
      values (${tid}, ${teamA.id}, ${teamB.id}, 'finished') returning id
    `;
    await tx`
      insert into public.match_events (match_id, tournament_id, player_id, team_id, type, minute)
      values (${m.id}, ${tid}, ${pA.id}, ${teamA.id}, 'goal', 12)
    `;
    await tx`
      insert into public.match_events (match_id, tournament_id, player_id, team_id, type, minute)
      values (${m.id}, ${tid}, ${pB.id}, ${teamB.id}, 'own_goal', 78)
    `;

    // A tournament that also declares a champion, so winner_team_id is exercised.
    await tx`update public.tournaments set winner_team_id = ${teamA.id} where id = ${tid}`;

    const before = await probe(tx as unknown as Queryable, tid, [pA.id, pB.id], [teamA.id, teamB.id]);
    console.log("BEFORE DELETE");
    print(before);

    await tx`delete from public.tournaments where id = ${tid}`;

    const after = await probe(tx as unknown as Queryable, tid, [pA.id, pB.id], [teamA.id, teamB.id]);
    console.log("\nAFTER DELETE");
    print(after);

    console.log("\nASSERTIONS");
    check("tournament gone", after.tournaments === 0);
    check("teams gone", after.teams === 0);
    check("matches gone", after.matches === 0);
    check("match_events gone", after.matchEvents === 0);
    check("team_players gone", after.teamPlayers === 0);
    check(
      "players kept but released (tournament_id nulled)",
      after.players === 2 && after.playersStillLinked === 0,
    );

    throw new Rollback();
  });

  await sql.end({ timeout: 5 });
}

class Rollback extends Error {}

type Queryable = {
  (strings: TemplateStringsArray, ...v: unknown[]): Promise<{ n: number }[]>;
};

/** Row counts for everything scoped to the probe tournament. */
async function probe(
  t: Queryable,
  tid: string,
  playerIds: string[],
  teamIds: string[],
): Promise<Record<string, number>> {
  const [tour] = await t`select count(*)::int n from public.tournaments where id = ${tid}`;
  const [tm] = await t`select count(*)::int n from public.teams where id = any(${teamIds})`;
  const [pl] = await t`select count(*)::int n from public.players where id = any(${playerIds})`;
  const [pll] = await t`
    select count(*)::int n from public.players
    where id = any(${playerIds}) and tournament_id is not null
  `;
  const [ma] = await t`select count(*)::int n from public.matches where tournament_id = ${tid}`;
  const [me] = await t`select count(*)::int n from public.match_events where tournament_id = ${tid}`;
  const [tp] = await t`select count(*)::int n from public.team_players where team_id = any(${teamIds})`;
  return {
    tournaments: tour.n,
    teams: tm.n,
    players: pl.n,
    playersStillLinked: pll.n,
    matches: ma.n,
    matchEvents: me.n,
    teamPlayers: tp.n,
  };
}

function print(o: Record<string, number>) {
  for (const [k, v] of Object.entries(o)) console.log(`  ${k.padEnd(20)} ${v}`);
}

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failures++;
}

main().catch((e) => {
  if (e instanceof Rollback) {
    console.log("\n(rolled back — live data untouched)");
    process.exit(failures === 0 ? 0 : 1);
  }
  console.error(e);
  process.exit(1);
});

// Keeps this file a module: without a top-level import or export the
// declarations would land in global scope and collide with sibling scripts.
export {};