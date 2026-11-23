import { readFileSync } from "node:fs";

/**
 * Adds competition-format support to an existing database and sets the mastic
 * tournament to tri-series (round-robin group phase, then 1st vs 2nd final).
 * Idempotent: safe to run repeatedly.
 */
async function main() {
  const env = readFileSync(".env.local", "utf8");
  const url =
    env.match(/^DIRECT_URL=(.*)$/m)?.[1]?.trim() ??
    env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
  if (!url) throw new Error("No DIRECT_URL or DATABASE_URL in .env.local");

  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { prepare: false, connect_timeout: 20, max: 1 });

  try {
    const tournamentCols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'tournaments'
    `;
    if (!tournamentCols.some((c) => c.column_name === "format")) {
      await sql.unsafe(`
        alter table public.tournaments
          add column format text not null default 'league'
            check (format in ('league','tri_series','knockout'))
      `);
      console.log("Added tournaments.format");
    } else {
      console.log("tournaments.format already present");
    }

    await sql.unsafe(`
      alter table public.matches drop constraint if exists matches_stage_check;
      alter table public.matches add constraint matches_stage_check
        check (stage in ('group','quarter','semi','final'));
    `);
    console.log("matches stage check widened");

    await sql`
      update tournaments set format = 'tri_series'
      where slug = 'mastic-end-of-year-tournament'
    `;

    const rows = await sql`
      select t.name, t.format,
             count(m.id)::int as matches,
             count(m.id) filter (where m.stage = 'final')::int as finals
      from tournaments t
      left join matches m on m.tournament_id = t.id
      where t.slug = 'mastic-end-of-year-tournament'
      group by t.id
    `;
    console.table(rows);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
