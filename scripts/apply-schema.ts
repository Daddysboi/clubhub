import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Applies supabase/schema.sql to the database in DATABASE_URL.
 * Safe to re-run: the schema is written to be idempotent.
 *
 * Usage: npx tsx scripts/apply-schema.ts
 */

// Scripts run outside Next, where .env.local is not loaded for us.
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