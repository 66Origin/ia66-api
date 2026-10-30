import assert from "node:assert/strict";
import { config } from "dotenv";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  try {
    const pool = getAnalyticsPool();

    const identity = await pool.query<{
      current_user: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>(`
      SELECT
        current_user,
        rolcanlogin,
        rolsuper,
        rolcreatedb,
        rolcreaterole,
        rolinherit,
        rolreplication,
        rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `);

    assert.deepEqual(identity.rows[0], {
      current_user: "o_analytics_writer",
      rolcanlogin: true,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolinherit: false,
      rolreplication: false,
      rolbypassrls: false,
    });

    console.log("Analytics writer identity: OK");

    const access = await pool.query<{
      schema_usage: boolean;
      schema_create: boolean;
      function_execute: boolean;
    }>(`
      SELECT
        has_schema_privilege('analytics', 'USAGE') AS schema_usage,
        has_schema_privilege('analytics', 'CREATE') AS schema_create,
        has_function_privilege(
          'analytics.record_chat_request(uuid,uuid,text)',
          'EXECUTE'
        ) AS function_execute
    `);

    assert.deepEqual(access.rows[0], {
      schema_usage: true,
      schema_create: false,
      function_execute: true,
    });

    const tables = await pool.query<{
      table_name: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
      can_truncate: boolean;
      rls_enabled: boolean;
    }>(`
      SELECT
        c.relname AS table_name,
        has_table_privilege(c.oid, 'SELECT') AS can_select,
        has_any_column_privilege(c.oid, 'INSERT') AS can_insert,
        has_any_column_privilege(c.oid, 'UPDATE') AS can_update,
        has_table_privilege(c.oid, 'DELETE') AS can_delete,
        has_table_privilege(c.oid, 'TRUNCATE') AS can_truncate,
        c.relrowsecurity AS rls_enabled
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'analytics'
        AND c.relname IN (
          'conversations',
          'chat_requests'
        )
      ORDER BY c.relname
    `);

    assert.deepEqual(
      tables.rows,
      ["chat_requests", "conversations"].map(
        (tableName) => ({
          table_name: tableName,
          can_select: true,
          can_insert: true,
          can_update: tableName !== "conversations",
          can_delete: false,
          can_truncate: false,
          rls_enabled: true,
        }),
      ),
    );

    // Retention runs inside the database: the writer has no access to it.
    const retention = await pool.query<{
      stats_access: boolean;
      retention_execute: boolean;
    }>(`
      SELECT
        has_table_privilege(
          'analytics.monthly_conversation_stats',
          'SELECT,INSERT,UPDATE,DELETE'
        )
        OR has_table_privilege(
          'analytics.monthly_request_stats',
          'SELECT,INSERT,UPDATE,DELETE'
        ) AS stats_access,
        has_function_privilege(
          'analytics.refresh_monthly_stats(interval)',
          'EXECUTE'
        )
        OR has_function_privilege(
          'analytics.purge_expired(interval,interval)',
          'EXECUTE'
        )
        OR has_function_privilege(
          'analytics.run_retention()',
          'EXECUTE'
        ) AS retention_execute
    `);

    assert.deepEqual(retention.rows[0], {
      stats_access: false,
      retention_execute: false,
    });

    // Unanswered questions: write-only for the API.
    const unanswered = await pool.query<{
      can_insert: boolean;
      can_select: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT
        has_any_column_privilege(
          'analytics.unanswered_questions', 'INSERT'
        ) AS can_insert,
        has_any_column_privilege(
          'analytics.unanswered_questions', 'SELECT'
        ) AS can_select,
        has_any_column_privilege(
          'analytics.unanswered_questions', 'UPDATE'
        ) AS can_update,
        has_table_privilege(
          'analytics.unanswered_questions', 'DELETE'
        ) AS can_delete
    `);

    assert.deepEqual(unanswered.rows[0], {
      can_insert: true,
      can_select: false,
      can_update: false,
      can_delete: false,
    });

    console.log("Analytics writer permissions: OK");
  } finally {
    await closeAnalyticsPool();
  }
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics writer permissions: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
