import { readFileSync } from "node:fs";

/**
 * Applies the manager_player_id addition to the live database.
 *
 * Idempotent: safe to run repeatedly. Mirrors the alter-table block in
 * supabase/schema.sql, which is the version new databases are built from.
 */

async function main() {
  const env = readFileSync(".env.local", "utf8");
  const url =
    env.match(/^DIRECT_URL=(.*)$/m)?.[1]?.trim() ??
    env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();

  if (!url) {
    console.error("No DIRECT_URL or DATABASE_URL in .env.local");
    process.exit(1);
  }

  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { prepare: false, connect_timeout: 20, max: 1 });

  try {
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'teams'
      order by column_name
    `;
    console.log("BEFORE:", cols.map((c) => c.column_name).join(", "));

    if (cols.some((c) => c.column_name === "manager_player_id")) {
      console.log("column manager_player_id already present");
    } else {
      await sql`alter table public.teams add column manager_player_id uuid`;
      console.log("added column manager_player_id");
    }

    await sql`create index if not exists teams_manager_idx on public.teams(manager_player_id)`;
    console.log("index teams_manager_idx ready");

    const fk = await sql`
      select 1 from pg_constraint where conname = 'teams_manager_player_id_fkey'
    `;
    if (fk.length === 0) {
      await sql.unsafe(`
        alter table public.teams
          add constraint teams_manager_player_id_fkey
          foreign key (manager_player_id) references public.players(id) on delete set null
      `);
      console.log("added FK teams_manager_player_id_fkey");
    } else {
      console.log("FK already present");
    }

    const after = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'teams'
      order by column_name
    `;
    console.log("AFTER:", after.map((c) => c.column_name).join(", "));
    console.log("Done.");
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main();