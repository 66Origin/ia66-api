import { Pool } from "pg";
import { readFileSync } from "node:fs";

type PoolName = "writer" | "reader";

const CONNECTION_VARIABLES: Record<PoolName, string> = {
  // Used by the chat API: records requests, never reads texts back.
  writer: "O_ANALYTICS_DATABASE_URL",
  // Used by the administration dashboard only: read-only.
  reader: "O_ANALYTICS_READER_DATABASE_URL",
};

const pools: Partial<Record<PoolName, Pool>> = {};

function getPool(name: PoolName): Pool {
  const existing = pools[name];

  if (existing) return existing;

  const variable = CONNECTION_VARIABLES[name];
  const connectionString = process.env[variable];

  if (!connectionString) {
    throw new Error(`${variable} is missing.`);
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      ca: readFileSync("certs/supabase-ca.crt", "utf8"),
      rejectUnauthorized: true,
    },
    max: 2,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 10_000,
    // Dashboard aggregations scan more rows than the chat inserts.
    query_timeout: name === "reader" ? 10_000 : 2_000,
  });

  pool.on("error", () => {
    console.error("[analytics] Unexpected idle database connection error.");
  });

  pools[name] = pool;

  return pool;
}

export function getAnalyticsPool(): Pool {
  return getPool("writer");
}

export function getAnalyticsReaderPool(): Pool {
  return getPool("reader");
}

export async function closeAnalyticsPool(): Promise<void> {
  const current = Object.values(pools);

  delete pools.writer;
  delete pools.reader;

  await Promise.all(current.map((pool) => pool.end()));
}
