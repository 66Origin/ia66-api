import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import type { PoolClient } from "pg";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

type RecordedRequest = {
  request_created: boolean;
  conversation_created: boolean;
  previous_conversation_count: number | null;
};

async function record(
  client: PoolClient,
  requestId: string,
  conversationId: string,
  visitorId: string,
) {
  const result = await client.query<RecordedRequest>(
    `SELECT *
     FROM analytics.record_chat_request(
       $1::uuid, $2::uuid, $3::uuid, $4::text
     )`,
    [requestId, conversationId, visitorId, "home"],
  );

  return result.rows[0];
}

async function checkConcurrentRequests(duplicate: boolean) {
  const pool = getAnalyticsPool();
  const visitorId = randomUUID();
  const conversationA = randomUUID();
  const conversationB = duplicate ? conversationA : randomUUID();
  const requestA = randomUUID();
  const requestB = duplicate ? requestA : randomUUID();
  const conversationIds = [conversationA, conversationB];

  const first = await pool.connect();
  let second: PoolClient | undefined;

  try {
    second = await pool.connect();

    // Each call runs in its own transaction and connection.
    const results = await Promise.allSettled([
      record(first, requestA, conversationA, visitorId),
      record(second, requestB, conversationB, visitorId),
    ]);

    const rows = results.map((result) => {
      if (result.status === "rejected") {
        throw result.reason;
      }

      return result.value;
    });

    const expectedCount = duplicate ? 1 : 2;

    const visitor = await first.query<{ conversation_count: number }>(
      `SELECT conversation_count
       FROM analytics.browser_visitors
       WHERE visitor_id = $1::uuid`,
      [visitorId],
    );

    assert.equal(
      visitor.rows[0]?.conversation_count,
      expectedCount,
      "Unexpected browser conversation count",
    );

    const conversations = await first.query<{
      previous_conversation_count: number;
    }>(
      `SELECT previous_conversation_count
       FROM analytics.conversations
       WHERE visitor_id = $1::uuid
       ORDER BY previous_conversation_count`,
      [visitorId],
    );

    assert.deepEqual(
      conversations.rows.map((row) => row.previous_conversation_count),
      duplicate ? [0] : [0, 1],
      "Unexpected conversation snapshots",
    );

    const requests = await first.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM analytics.chat_requests
       WHERE conversation_id = ANY($1::uuid[])`,
      [conversationIds],
    );

    assert.equal(
      requests.rows[0]?.count,
      expectedCount,
      "Unexpected request count",
    );

    assert.equal(
      rows.filter((row) => row.request_created).length,
      expectedCount,
    );

    assert.equal(
      rows.filter((row) => row.conversation_created).length,
      expectedCount,
    );
  } finally {
    // Delete only this scenario's randomly identified data.
    try {
      await first.query("BEGIN");

      await first.query(
        `DELETE FROM analytics.chat_requests
         WHERE conversation_id = ANY($1::uuid[])`,
        [conversationIds],
      );

      await first.query(
        `DELETE FROM analytics.conversations
         WHERE conversation_id = ANY($1::uuid[])`,
        [conversationIds],
      );

      await first.query(
        `DELETE FROM analytics.browser_visitors
         WHERE visitor_id = $1::uuid`,
        [visitorId],
      );

      await first.query("COMMIT");
    } catch (error) {
      await first.query("ROLLBACK");
      throw error;
    } finally {
      second?.release();
      first.release();
    }
  }
}

async function main() {
  try {
    await checkConcurrentRequests(false);
    console.log("Concurrent conversations: OK");

    await checkConcurrentRequests(true);
    console.log("Concurrent duplicate request: OK");
  } finally {
    await closeAnalyticsPool();
  }
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics concurrency checks: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
