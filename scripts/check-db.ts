import postgres from "postgres";

/**
 * Verifies the database connection using DATABASE_URL from .env.local.
 * Run with: npx tsx scripts/check-db.ts
 *
 * Credentials are read from the environment only — never hardcoded.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }

  // Never print the URL: it contains the password.
  const host = new URL(url).host;

  const sql = postgres(url, { prepare: false, connect_timeout: 12, max: 1 });
  try {
    const rows = await sql<{ db: string; usr: string }[]>`
      select current_database() as db, current_user as usr
    `;
    console.log(`Connected to ${host}`);
    console.log(`  database=${rows[0].db} user=${rows[0].usr}`);

    const tables = await sql<{ count: number }[]>`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'public'
    `;
    console.log(`  public tables=${tables[0].count}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Connection to ${host} failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main();