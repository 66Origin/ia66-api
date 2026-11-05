import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import type { PoolClient } from "pg";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";
import { deleteTestConversations } from "./cleanup-test-data";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

type RecordedRequest = {
  request_created: boolean;
  conversation_created: boolean;
};

async function record(
  client: PoolClient,
  requestId: string,
  conversationId: string,
) {
  const result = await client.query<RecordedRequest>(
    `SELECT *
     FROM analytics.record_chat_request(
       $1::uuid, $2::uuid, $3::text
     )`,
    [requestId, conversationId, "home"],
  );

  return result.rows[0];
}

async function checkConcurrentRequests(duplicate: boolean) {
  const pool = getAnalyticsPool();
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
      record(first, requestA, conversationA),
      record(second, requestB, conversationB),
    ]);

    const rows = results.map((result) => {
      if (result.status === "rejected") {
        throw result.reason;
      }

      return result.value;
    });

    const expectedCount = duplicate ? 1 : 2;

    const conversations = await first.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM analytics.conversations
       WHERE conversation_id = ANY($1::uuid[])`,
      [conversationIds],
    );

    assert.equal(
      conversations.rows[0]?.count,
      expectedCount,
      "Unexpected conversation count",
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
    second?.release();
    first.release();

    // Delete only this scenario's randomly identified data.
    await deleteTestConversations(conversationIds);
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
