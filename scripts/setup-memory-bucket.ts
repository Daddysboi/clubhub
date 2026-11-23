/**
 * Creates the public Supabase Storage bucket used by the tournament album.
 *
 *   npx tsx scripts/setup-memory-bucket.ts
 *
 * supabase/schema.sql also creates it, so this is only needed when SQL editor
 * access to storage.buckets is restricted on your project. Safe to re-run.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

async function main() {
  // Scripts run outside Next, where .env.local is not loaded for us.
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) {
      process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  // Built here rather than importing lib/db/supabase: that module imports
  // "server-only", which throws when a script runs outside Next.js.
  const { storage } = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = "tournament-memories";
  const { data: existing } = await storage.getBucket(bucket);
  const options = {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  };

  if (existing) {
    const { error } = await storage.updateBucket(bucket, options);
    if (error) throw error;
    console.log(`Updated existing bucket "${bucket}".`);
  } else {
    const { error } = await storage.createBucket(bucket, options);
    if (error) throw error;
    console.log(`Created bucket "${bucket}".`);
  }
}

main();
