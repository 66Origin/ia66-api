import assert from "node:assert/strict";
import { config } from "dotenv";
import {
  closeAnalyticsPool,
  getAnalyticsReaderPool,
} from "../../src/lib/analytics/db";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const TABLES = [
  "chat_requests",
  "conversations",
  "monthly_conversation_stats",
  "monthly_request_stats",
  "request_classifications",
  "unanswered_questions",
] as const;

async function main() {
  try {
    const pool = getAnalyticsReaderPool();

    const identity = await pool.query<{
      current_user: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(`
      SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `);

    assert.deepEqual(identity.rows[0], {
      current_user: "o_analytics_reader",
      rolsuper: false,
      rolbypassrls: false,
    });

    console.log("Analytics reader identity: OK");

    const tables = await pool.query<{
      table_name: string;
      can_select: boolean;
      can_write: boolean;
    }>(
      `SELECT
         c.relname AS table_name,
         has_table_privilege(c.oid, 'SELECT') AS can_select,
         has_any_column_privilege(c.oid, 'INSERT')
           OR has_any_column_privilege(c.oid, 'UPDATE')
           OR has_table_privilege(c.oid, 'DELETE')
           OR has_table_privilege(c.oid, 'TRUNCATE') AS can_write
       FROM pg_class AS c
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'analytics'
         AND c.relname = ANY($1::text[])
       ORDER BY c.relname`,
      [TABLES],
    );

    assert.deepEqual(
      tables.rows,
      TABLES.map((tableName) => ({
        table_name: tableName,
        can_select: true,
        can_write: false,
      })),
    );

    const functions = await pool.query<{ can_execute: boolean }>(`
      SELECT
        has_function_privilege(
          'analytics.record_chat_request(uuid,uuid,text)', 'EXECUTE'
        )
        OR has_function_privilege(
          'analytics.purge_expired(interval,interval)', 'EXECUTE'
        )
        OR has_function_privilege(
          'analytics.refresh_monthly_stats(interval)', 'EXECUTE'
        )
        OR has_function_privilege('analytics.run_retention()', 'EXECUTE')
        AS can_execute
    `);

    assert.equal(functions.rows[0]?.can_execute, false);

    // Policies must let the role actually read rows through RLS.
    for (const table of TABLES) {
      await pool.query(`SELECT 1 FROM analytics.${table} LIMIT 1`);
    }

    console.log("Analytics reader permissions: OK");
  } finally {
    await closeAnalyticsPool();
  }
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics reader permissions: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
