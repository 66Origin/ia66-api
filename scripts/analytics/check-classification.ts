import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import type { PoolClient } from "pg";
import {
  CLASSIFICATION_VERSION,
  type ClassificationOutcome,
} from "../../src/lib/analytics/classification";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";
import { recordClassification } from "../../src/lib/analytics/record-classification";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function expectDatabaseError(
  client: PoolClient,
  operation: () => Promise<unknown>,
  expectedCode: string,
) {
  await client.query("SAVEPOINT classification_check");

  let actualCode: string | undefined;

  try {
    await operation();
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error) {
      actualCode = String(error.code);
    }
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT classification_check");
    await client.query("RELEASE SAVEPOINT classification_check");
  }

  assert.equal(actualCode, expectedCode);
}

async function main() {
  try {
    const client = await getAnalyticsPool().connect();

    try {
      await client.query("BEGIN");

      const identity = await client.query("SELECT current_user");

      assert.equal(identity.rows[0]?.current_user, "o_analytics_writer");

      const conversationId = randomUUID();

      const outcomes: ClassificationOutcome[] = [
        {
          status: "classified",
          subject: "projects_references",
          intent: "explore_references",
        },
        {
          status: "unclassifiable",
          subject: null,
          intent: null,
        },
        {
          status: "failed",
          subject: null,
          intent: null,
        },
      ];

      for (const outcome of outcomes) {
        const requestId = randomUUID();

        await client.query(
          `SELECT *
           FROM analytics.record_chat_request(
             $1::uuid,
             $2::uuid,
             NULL::uuid,
             'home'::text
           )`,
          [requestId, conversationId],
        );

        const input = { requestId, outcome };

        assert.deepEqual(await recordClassification(input, client), {
          created: true,
        });

        assert.deepEqual(await recordClassification(input, client), {
          created: false,
        });

        const saved = await client.query(
          `SELECT
             subject,
             intent,
             classification_status,
             classification_version,
             classified_at IS NOT NULL AS has_classified_at
           FROM analytics.request_classifications
           WHERE request_id = $1::uuid`,
          [requestId],
        );

        assert.deepEqual(saved.rows[0], {
          subject: outcome.subject,
          intent: outcome.intent,
          classification_status: outcome.status,
          classification_version: CLASSIFICATION_VERSION,
          has_classified_at: outcome.status !== "failed",
        });

        const differentOutcome: ClassificationOutcome =
          outcome.status === "failed"
            ? {
                status: "unclassifiable",
                subject: null,
                intent: null,
              }
            : {
                status: "failed",
                subject: null,
                intent: null,
              };

        await assert.rejects(
          () =>
            recordClassification(
              { requestId, outcome: differentOutcome },
              client,
            ),
          /already has a different classification/,
        );
      }

      await expectDatabaseError(
        client,
        () =>
          recordClassification(
            {
              requestId: randomUUID(),
              outcome: {
                status: "failed",
                subject: null,
                intent: null,
              },
            },
            client,
          ),
        "23503",
      );

      await expectDatabaseError(
        client,
        () =>
          client.query(
            `UPDATE analytics.request_classifications
             SET subject = subject
             WHERE false`,
          ),
        "42501",
      );

      await expectDatabaseError(
        client,
        () =>
          client.query(
            `DELETE FROM analytics.request_classifications
             WHERE false`,
          ),
        "42501",
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

  console.log("Analytics classification outcomes: OK");
  console.log("Analytics classification duplicate protection: OK");
  console.log("Analytics classification foreign key: OK");
  console.log("Analytics classification forbidden operations: OK");
  console.log("Analytics classification transaction rollback: OK");
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics classification: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
