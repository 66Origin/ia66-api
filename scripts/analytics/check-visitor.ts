import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";
import { registerVisitor } from "../../src/lib/analytics/register-visitor";
import { createVisitorToken } from "../../src/lib/analytics/visitor-token";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const visitorId = randomUUID();
  const expiresAt = Date.now() + 60_000;
  const token = createVisitorToken(visitorId, expiresAt);

  try {
    assert.equal(await registerVisitor("invalid-token"), null);

    const first = await registerVisitor(token);

    assert.deepEqual(first, {
      visitorId,
      expiresAt,
    });

    const repeated = await registerVisitor(token);

    assert.deepEqual(repeated, first);

    const saved = await getAnalyticsPool().query<{
      conversation_count: number;
      recognition_expires_at: Date;
    }>(
      `SELECT conversation_count, recognition_expires_at
       FROM analytics.browser_visitors
       WHERE visitor_id = $1::uuid`,
      [visitorId],
    );

    assert.equal(saved.rows.length, 1);
    assert.equal(saved.rows[0].conversation_count, 0);
    assert.equal(saved.rows[0].recognition_expires_at.getTime(), expiresAt);

    // Even a signed token cannot extend an existing identity's expiration.
    const extendedToken = createVisitorToken(visitorId, expiresAt + 60_000);

    await assert.rejects(() => registerVisitor(extendedToken), {
      message: "Visitor recognition expiration is inconsistent or expired.",
    });

    const afterConflict = await getAnalyticsPool().query<{
      recognition_expires_at: Date;
    }>(
      `SELECT recognition_expires_at
       FROM analytics.browser_visitors
       WHERE visitor_id = $1::uuid`,
      [visitorId],
    );

    assert.equal(
      afterConflict.rows[0].recognition_expires_at.getTime(),
      expiresAt,
    );
  } finally {
    try {
      await getAnalyticsPool().query(
        `DELETE FROM analytics.browser_visitors
         WHERE visitor_id = $1::uuid`,
        [visitorId],
      );
    } finally {
      await closeAnalyticsPool();
    }
  }

  console.log("Analytics visitor registration: OK");
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics visitor registration: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
