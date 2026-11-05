import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import type { PoolClient } from "pg";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";
import { recordUnansweredQuestion } from "../../src/lib/analytics/record-unanswered-question";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// A rejected statement aborts the transaction even when the code catches
// it, so each probe runs in a savepoint that is always rolled back.
async function probe<T>(
  client: PoolClient,
  operation: () => Promise<T>,
): Promise<{ value?: T; code?: string }> {
  await client.query("SAVEPOINT unanswered_probe");

  try {
    return { value: await operation() };
  } catch (error: unknown) {
    return {
      code:
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "UNKNOWN",
    };
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT unanswered_probe");
    await client.query("RELEASE SAVEPOINT unanswered_probe");
  }
}

async function main() {
  try {
    const client = await getAnalyticsPool().connect();

    try {
      await client.query("BEGIN");

      const identity = await client.query("SELECT current_user");
      assert.equal(identity.rows[0]?.current_user, "o_analytics_writer");

      const requestId = randomUUID();

      await client.query(
        `SELECT *
         FROM analytics.record_chat_request($1::uuid, $2::uuid, 'home'::text)`,
        [requestId, randomUUID()],
      );

      const input = {
        requestId,
        question: "Écrivez-moi à test@example.com ou au 06 12 34 56 78",
        reason: "unclassifiable" as const,
      };

      assert.deepEqual(await recordUnansweredQuestion(input, client), {
        created: true,
      });

      // The duplicate is rejected by the primary key; the first reason stays.
      assert.deepEqual(
        await probe(client, () =>
          recordUnansweredQuestion(
            { ...input, reason: "generation_failed" },
            client,
          ),
        ),
        { value: { created: false } },
      );

      console.log("Unanswered question recording: OK");

      // The API can write these questions but must not read them back.
      assert.deepEqual(
        await probe(client, () =>
          client.query("SELECT question FROM analytics.unanswered_questions"),
        ),
        { code: "42501" },
      );

      assert.deepEqual(
        await probe(client, () =>
          client.query("DELETE FROM analytics.unanswered_questions WHERE false"),
        ),
        { code: "42501" },
      );

      console.log("Unanswered question write-only access: OK");
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
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics unanswered checks: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
