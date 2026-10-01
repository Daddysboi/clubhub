/**
 * Prints the ON DELETE rule for every foreign key in the schema, plus current row
 * counts. Use when a cascade does not behave as expected.
 *
 * Run with: npx tsx scripts/check-cascade.ts
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

  const rows = await sql`
  select
    con.conname,
    src.relname as source_table,
    tgt.relname as target_table,
    con.confdeltype as on_delete
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  where con.contype = 'f'
    and src.relname in ('tournaments','teams','players','matches','team_players','match_events')
  order by src.relname, con.conname
`;

const code: Record<string, string> = {
    a: "NO ACTION",
    r: "RESTRICT",
    c: "CASCADE",
    n: "SET NULL",
    d: "SET DEFAULT",
  };

  console.log("FOREIGN KEY DELETE BEHAVIOUR");
  console.log("source".padEnd(14), "-> target".padEnd(14), "on delete".padEnd(12), "constraint");
  for (const r of rows) {
    console.log(
      String(r.source_table).padEnd(14),
      `-> ${r.target_table}`.padEnd(14),
      code[String(r.on_delete)].padEnd(12),
      r.conname,
    );
  }

  const counts = await sql`
    select 'tournaments' as t, count(*)::int as n from public.tournaments
    union all select 'teams', count(*)::int from public.teams
    union all select 'players', count(*)::int from public.players
    union all select 'matches', count(*)::int from public.matches
    union all select 'team_players', count(*)::int from public.team_players
    union all select 'match_events', count(*)::int from public.match_events
  `;
  console.log("\nCURRENT ROW COUNTS");
  for (const c of counts) console.log(String(c.t).padEnd(14), c.n);

  await sql.end({ timeout: 5 });
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});

// Keeps this file a module: without a top-level import or export the
// declarations would land in global scope and collide with sibling scripts.
export {};