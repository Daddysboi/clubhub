import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Applies supabase/schema.sql to the database in DATABASE_URL.
 * Safe to re-run: the schema is written to be idempotent.
 *
 * Usage: npx tsx scripts/apply-schema.ts
 */

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }

  const sql = readFileSync("supabase/schema.sql", "utf8");
  const client = postgres(url, { prepare: false, connect_timeout: 15, max: 1 });

  try {
    await client.unsafe(sql);
    console.log("Schema applied successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Schema application failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
}

main();