import { Pool } from "pg";
import { readFileSync } from "node:fs";

let pool: Pool | undefined;

export function getAnalyticsPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.O_ANALYTICS_DATABASE_URL;

  if (!connectionString) {
    throw new Error("O_ANALYTICS_DATABASE_URL is missing.");
  }

  pool = new Pool({
    connectionString,
    ssl: {
      ca: readFileSync("certs/supabase-ca.crt", "utf8"),
      rejectUnauthorized: true,
    },
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    query_timeout: 5_000,
  });

  pool.on("error", () => {
    console.error("[analytics] Unexpected idle database connection error.");
  });

  return pool;
}

export async function closeAnalyticsPool(): Promise<void> {
  const currentPool = pool;
  pool = undefined;

  if (currentPool) {
    await currentPool.end();
  }
}
