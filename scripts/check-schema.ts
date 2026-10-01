import postgres from "postgres";

/** Reports which tables from supabase/schema.sql already exist. */

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, connect_timeout: 12, max: 1 });
  try {
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `;
    const existing = rows.map((r) => r.table_name);

    const expected = [
      "admins", "matches", "match_events", "players",
      "team_players", "teams", "tournaments",
    ];

    const missing = expected.filter((t) => !existing.includes(t));
    console.log(`existing: ${existing.length ? existing.join(", ") : "(none)"}`);
    console.log("");
    if (missing.length) {
      console.log(`MISSING (${missing.length}): ${missing.join(", ")}`);
      console.log("Schema has not been applied. Run: npx tsx scripts/apply-schema.ts");
    } else {
      console.log("All application tables are present.");
    }

    const counts = await sql<{ table_name: string; n: number }[]>`
      select 'tournaments' as table_name, count(*)::int as n from tournaments
      union all select 'teams', count(*)::int from teams
      union all select 'players', count(*)::int from players
    `;
    console.log("");
    for (const c of counts) console.log(`${c.table_name}: ${c.n} rows`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Query failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main();