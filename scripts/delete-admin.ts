import { readFileSync } from "node:fs";

/**
 * Removes an organiser login entirely: the Supabase auth user and the
 * public.admins row that grants them access.
 *
 * Usage:
 *   npx tsx scripts/delete-admin.ts admin@nhia.gov.ng
 */

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/delete-admin.ts <email>");
    process.exit(1);
  }

  const env = readFileSync(".env.local", "utf8");
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
  const serviceKey = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

  if (!url || !serviceKey || serviceKey.startsWith("PASTE_")) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and a real SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    console.error(`Could not list users: ${listError.message}`);
    process.exit(1);
  }

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.log(`No auth user found for ${email} — nothing to delete.`);
    return;
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(`Could not delete auth user: ${deleteError.message}`);
    process.exit(1);
  }
  console.log(`Deleted auth user ${email} (${user.id})`);

  const databaseUrl = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL missing from .env.local");
    process.exit(1);
  }

  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { prepare: false, connect_timeout: 15, max: 1 });

  try {
    const removed = await sql`
      delete from public.admins where user_id = ${user.id}::uuid
      returning email
    `;
    if (removed.length) {
      console.log(`Removed admins row for ${removed[0].email}`);
    } else {
      console.log("No admins row was present.");
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main();