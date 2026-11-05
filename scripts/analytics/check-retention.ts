import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Inserting dated rows and calling the retention functions needs the
// privileged connection used by the check scripts. Everything runs in one
// transaction that is rolled back: the database is left unchanged.
function getPrivilegedPool(): Pool {
  const connectionString = process.env.O_ANALYTICS_CLEANUP_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "O_ANALYTICS_CLEANUP_DATABASE_URL is required for this check.",
    );
  }

  return new Pool({
    connectionString,
    ssl: {
      ca: readFileSync("certs/supabase-ca.crt", "utf8"),
      rejectUnauthorized: true,
    },
    max: 1,
    connectionTimeoutMillis: 2_000,
  });
}

type ConversationStats = {
  conversations: number;
  requests: number;
  failed_requests: number;
  conversations_1_request: number;
  conversations_2_3_requests: number;
};

async function previousMonthStats(
  client: PoolClient,
): Promise<ConversationStats> {
  const result = await client.query<ConversationStats>(
    `SELECT
       coalesce(sum(conversations), 0)::integer AS conversations,
       coalesce(sum(requests), 0)::integer AS requests,
       coalesce(sum(failed_requests), 0)::integer AS failed_requests,
       coalesce(sum(conversations_1_request), 0)::integer
         AS conversations_1_request,
       coalesce(sum(conversations_2_3_requests), 0)::integer
         AS conversations_2_3_requests
     FROM analytics.monthly_conversation_stats
     WHERE month = (
       date_trunc('month', now() AT TIME ZONE 'Europe/Paris')
       - interval '1 month'
     )::date
       AND placement = 'home'`,
  );

  return result.rows[0];
}

async function insertConversation(
  client: PoolClient,
  startedAt: string,
  statuses: Array<"generated" | "failed">,
): Promise<string> {
  const conversationId = randomUUID();

  await client.query(
    `INSERT INTO analytics.conversations (conversation_id, started_at, placement)
     VALUES ($1::uuid, (${startedAt}), 'home')`,
    [conversationId],
  );

  for (const [index, status] of statuses.entries()) {
    await client.query(
      `INSERT INTO analytics.chat_requests (
         request_id, conversation_id, received_at, status,
         completed_at, generation_duration_ms
       )
       VALUES (
         $1::uuid, $2::uuid,
         (${startedAt}) + $3 * interval '1 minute',
         $4,
         (${startedAt}) + $3 * interval '1 minute',
         CASE WHEN $4 = 'generated' THEN 1000 END
       )`,
      [randomUUID(), conversationId, index, status],
    );
  }

  return conversationId;
}

async function main() {
  const pool = getPrivilegedPool();

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query("SELECT analytics.refresh_monthly_stats()");
      const before = await previousMonthStats(client);

      const previousMonth =
        "(date_trunc('month', now() AT TIME ZONE 'Europe/Paris')" +
        " - interval '1 month' + interval '2 days') AT TIME ZONE 'Europe/Paris'";

      await insertConversation(client, previousMonth, ["generated"]);
      await insertConversation(client, previousMonth, [
        "failed",
        "generated",
      ]);

      const expiredConversationId = await insertConversation(
        client,
        "now() - interval '13 months'",
        ["generated"],
      );

      await client.query("SELECT analytics.run_retention()");

      const after = await previousMonthStats(client);

      assert.deepEqual(
        {
          conversations: after.conversations - before.conversations,
          requests: after.requests - before.requests,
          failed_requests: after.failed_requests - before.failed_requests,
          conversations_1_request:
            after.conversations_1_request - before.conversations_1_request,
          conversations_2_3_requests:
            after.conversations_2_3_requests -
            before.conversations_2_3_requests,
        },
        {
          conversations: 2,
          requests: 3,
          failed_requests: 1,
          conversations_1_request: 1,
          conversations_2_3_requests: 1,
        },
        "Monthly statistics do not include the test conversations.",
      );

      console.log("Monthly statistics: OK");

      const expired = await client.query(
        `SELECT 1
         FROM analytics.conversations
         WHERE conversation_id = $1::uuid`,
        [expiredConversationId],
      );

      assert.equal(expired.rowCount, 0, "Expired conversation was kept.");
      console.log("Purge of expired rows: OK");

      const cron = await client.query<{ installed: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
         ) AS installed`,
      );

      if (cron.rows[0]?.installed) {
        const job = await client.query(
          `SELECT schedule, command
           FROM cron.job
           WHERE jobname = 'o-analytics-retention'
             AND active`,
        );

        assert.equal(job.rowCount, 1, "Retention job is not scheduled.");
        console.log(`Retention schedule: OK (${job.rows[0].schedule} UTC)`);
      } else {
        console.warn("Retention schedule: pg_cron is not installed.");
      }
    } finally {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics retention checks: FAILED (${code})`);

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
