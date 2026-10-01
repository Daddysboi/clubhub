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
  return postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = globalForDb.sqlClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.sqlClient = client;

export const db = drizzle(client, { schema });
export { schema };