import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and paste your connection string.",
  );
}

/**
 * Neon's own host is reached over HTTP, which is what makes it work on
 * serverless without connection pooling headaches. Anything else — a
 * local Postgres, a VPS, Supabase's direct connection — goes over the
 * ordinary TCP driver instead.
 */
const isNeonHttp = /\.neon\.(tech|build)/.test(connectionString);

function createDb() {
  if (isNeonHttp) {
    return drizzleNeon(neon(connectionString!), { schema });
  }
  const client = postgres(connectionString!, {
    // One connection per serverless invocation; Postgres-side pooling
    // (PgBouncer, Supabase pooler) should do the rest.
    max: 1,
    ssl: connectionString!.includes("localhost") ? false : "prefer",
  });
  return drizzlePostgres(client, { schema });
}

/**
 * The two drivers expose the same query builder, so the app is written
 * against one type and the other is structurally compatible.
 */
export const db = createDb() as unknown as NeonHttpDatabase<typeof schema>;

export { schema };
