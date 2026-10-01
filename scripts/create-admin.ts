import { readFileSync } from "node:fs";

/**
 * Creates the organiser login.
 *
 * Steps:
 *   1. Create (or update) the auth user with a confirmed email.
 *   2. Add the row to public.admins — the app checks this table, so a
 *      valid Supabase session alone does NOT grant access.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts admin@nhia.gov.ng 'your-password'
 *
 * Requires NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
 */

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const env = readFileSync(".env.local", "utf8");
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
  const serviceKey = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

  if (!url) {
    console.error("NEXT_PUBLIC_SUPABASE_URL missing from .env.local");
    process.exit(1);
  }

  if (!serviceKey || serviceKey.startsWith("PASTE_")) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is still a placeholder.");
    console.error("Get it from Supabase -> Settings -> API -> service_role.");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Upsert the auth user.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId = created?.user?.id;

  if (createError) {
    if (!/already been registered|already exists/i.test(createError.message)) {
      console.error(`Could not create user: ${createError.message}`);
      process.exit(1);
    }
    // Already exists — find it and reset the password.
    console.log("User already exists — resetting the password.");
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (listError) {
      console.error(`Could not list users: ${listError.message}`);
      process.exit(1);
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      console.error("User exists but was not found in the user list.");
      process.exit(1);
    }
    userId = existing.id;
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      console.error(`Could not update password: ${updateError.message}`);
      process.exit(1);
    }
  }

  console.log(`Auth user ready: ${email} (${userId})`);

  // 2. Grant organiser access.
  const databaseUrl = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL missing from .env.local");
    process.exit(1);
  }

  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { prepare: false, connect_timeout: 15, max: 1 });

  try {
    await sql`
      insert into public.admins (user_id, email)
      values (${userId as string}::uuid, ${email as string})
      on conflict (user_id) do update set email = excluded.email
    `;
    console.log("Added to public.admins — organiser access granted.");
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }

  console.log("");
  console.log("Done. Sign in at /admin with:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main();