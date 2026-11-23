import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Verifies the database-level guarantees added in supabase/schema.sql.
 *
 * Usage: npx tsx scripts/verify-db-hardening.ts
 */

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) {
      process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // Fall back to the ambient environment (e.g. CI or Vercel).
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, connect_timeout: 15, max: 1 });
  let failed = false;

  try {
    const expectedConstraints = [
      "tournaments_format_check",
      "tournaments_status_check",
      "players_position_check",
      "matches_stage_check",
      "matches_status_check",
      "matches_round_positive_check",
      "matches_score_nonnegative_check",
      "matches_finished_score_check",
      "match_events_type_check",
      "match_events_minute_check",
    ];
    const constraints = await sql<{ conname: string }[]>`
      select conname from pg_constraint where connamespace = 'public'::regnamespace
    `;
    const constraintNames = new Set(constraints.map((r) => r.conname));

    const expectedIndexes = [
      "matches_one_final_per_tournament_idx",
      "match_events_dedupe_idx",
      "match_events_card_dedupe_idx",
    ];
    const indexes = await sql<{ indexname: string }[]>`
      select indexname from pg_indexes where schemaname = 'public'
    `;
    const indexNames = new Set(indexes.map((r) => r.indexname));

    const policies = await sql<{
      schemaname: string;
      tablename: string;
      policyname: string;
      permissive: string;
    }[]>`
      select schemaname, tablename, policyname, permissive
      from pg_policies
      where (schemaname = 'storage' and tablename = 'objects')
         or (schemaname = 'public' and tablename in ('memory_likes', 'memory_comments'))
      order by schemaname, tablename, policyname
    `;

    const buckets = await sql<{ public: boolean; file_size_limit: string }[]>`
      select public, file_size_limit from storage.buckets where id = 'tournament-memories'
    `;

    const views = await sql<{ name: string | null }[]>`
      select to_regclass('public.public_players')::text as name
    `;

    const check = (label: string, ok: boolean) => {
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
      if (!ok) failed = true;
    };

    for (const name of expectedConstraints) {
      check(`constraint ${name}`, constraintNames.has(name));
    }
    for (const name of expectedIndexes) {
      check(`index ${name}`, indexNames.has(name));
    }

    for (const cmd of ["INSERT", "UPDATE", "DELETE"]) {
      const name = `block public memory object ${cmd.toLowerCase()}`;
      const policy = policies.find((p) => p.schemaname === "storage" && p.policyname === name);
      const isRestrictive =
        policy?.permissive === "R" || policy?.permissive === "RESTRICTIVE";
      check(
        `restrictive storage policy ${name}`,
        Boolean(policy && isRestrictive && policy.tablename === "objects"),
      );
    }

    check(
      "no Data API SELECT policy on engagement tables",
      !policies.some(
        (p) => p.schemaname === "public" && ["memory_likes", "memory_comments"].includes(p.tablename),
      ),
    );
    check("legacy public_players view removed", views[0]?.name == null);
    check("memory bucket is public", buckets[0]?.public === true);
    check("memory bucket limit is 5MB", buckets[0]?.file_size_limit === "5242880");
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }

  if (failed) process.exitCode = 1;
}

main();
