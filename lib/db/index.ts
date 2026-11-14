import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sqlClient?: ReturnType<typeof postgres>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.local.example to .env.local and add your Supabase connection string.",
    );
  }
  // Supabase's pooler in SESSION mode (port 5432) holds a server connection for
  // every client for its whole lifetime and caps the project at pool_size (15).
  // Vercel spawns several instances, which exhausts it and every DB page 500s
  // with EMAXCONNSESSION. Transaction mode (6543) is the correct choice.
  if (url.includes(".pooler.supabase.com") && /:5432(\/|$|\?)/.test(url)) {
    console.warn(
      "[db] DATABASE_URL uses Supabase session mode (port 5432). " +
        "Serverless deployments will hit EMAXCONNSESSION — use the transaction pooler on port 6543.",
    );
  }

  return postgres(url, {
    // Supavisor's transaction pooler (port 6543) cannot use prepared
    // statements, so this must stay false.
    prepare: false,
    // Serverless: every function instance is its own process, so a large local
    // pool multiplies across instances and exhausts the project's connection
    // limit. One connection per instance queues the handful of parallel queries
    // instead of opening a pool each.
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = globalForDb.sqlClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.sqlClient = client;

export const db = drizzle(client, { schema });
export { schema };