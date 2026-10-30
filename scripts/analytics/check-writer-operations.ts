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

async function expectPermissionDenied(client: PoolClient, statement: string) {
  await client.query("SAVEPOINT permission_check");

  let errorCode: string | undefined;

  try {
    await client.query(statement);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error) {
      errorCode = String(error.code);
    }
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT permission_check");
    await client.query("RELEASE SAVEPOINT permission_check");
  }

  assert.equal(errorCode, "42501", "Expected insufficient_privilege.");
}

async function main() {
  try {
    const client = await getAnalyticsPool().connect();

    try {
      await client.query("BEGIN");

      const identity = await client.query<{ current_user: string }>(
        "SELECT current_user",
      );

      assert.equal(identity.rows[0]?.current_user, "o_analytics_writer");

      const firstConversationId = randomUUID();
      const secondConversationId = randomUUID();
      const firstRequestId = randomUUID();

      const recordRequest = async (
        requestId: string,
        conversationId: string,
      ) => {
        const result = await client.query(
          `SELECT *
           FROM analytics.record_chat_request(
             $1::uuid,
             $2::uuid,
             $3::text
           )`,
          [requestId, conversationId, "home"],
        );

        return result.rows[0];
      };

      assert.deepEqual(
        await recordRequest(firstRequestId, firstConversationId),
        {
          request_created: true,
          conversation_created: true,
        },
      );

      assert.deepEqual(
        await recordRequest(firstRequestId, firstConversationId),
        {
          request_created: false,
          conversation_created: false,
        },
      );

      assert.deepEqual(
        await recordRequest(randomUUID(), firstConversationId),
        {
          request_created: true,
          conversation_created: false,
        },
      );

      assert.deepEqual(
        await recordRequest(randomUUID(), secondConversationId),
        {
          request_created: true,
          conversation_created: true,
        },
      );

      const completeRequest = () =>
        client.query(
          `UPDATE analytics.chat_requests
           SET
             status = 'generated',
             completed_at = clock_timestamp(),
             generation_duration_ms = 150,
             error_stage = NULL,
             error_code = NULL
           WHERE request_id = $1::uuid
             AND status = 'received'
           RETURNING request_id`,
          [firstRequestId],
        );

      assert.equal((await completeRequest()).rowCount, 1);
      assert.equal((await completeRequest()).rowCount, 0);

      const saved = await client.query(
        `SELECT status, generation_duration_ms
         FROM analytics.chat_requests
         WHERE request_id = $1::uuid`,
        [firstRequestId],
      );

      assert.deepEqual(saved.rows[0], {
        status: "generated",
        generation_duration_ms: 150,
      });

      // WHERE false prevents deletion even if permissions are misconfigured.
      await expectPermissionDenied(
        client,
        "DELETE FROM analytics.conversations WHERE false",
      );

      await expectPermissionDenied(
        client,
        "DELETE FROM analytics.chat_requests WHERE false",
      );

      await expectPermissionDenied(
        client,
        `UPDATE analytics.conversations
         SET placement = placement
         WHERE false`,
      );

      await expectPermissionDenied(
        client,
        `UPDATE analytics.chat_requests
         SET request_id = request_id
         WHERE false`,
      );
    } finally {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  } finally {
    await closeAnalyticsPool();
  }

  console.log("Analytics writer recording: OK");
  console.log("Analytics writer completion: OK");
  console.log("Analytics writer forbidden operations: OK");
  console.log("Analytics writer transaction rollback: OK");
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics writer operations: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
