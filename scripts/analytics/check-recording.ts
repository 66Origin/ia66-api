import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";
import { recordChatRequest } from "../../src/lib/analytics/record-chat-request";
import { completeChatRequest } from "../../src/lib/analytics/complete-chat-request";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const visitorId = randomUUID();
  const conversationId = randomUUID();
  const unknownConversationId = randomUUID();

  const input = {
    requestId: randomUUID(),
    conversationId,
    visitorId,
    placement: "home" as const,
  };

  try {
    const first = await recordChatRequest(input);

    assert.deepEqual(first, {
      requestCreated: true,
      conversationCreated: true,
      previousConversationCount: 0,
    });

    const duplicate = await recordChatRequest(input);

    assert.deepEqual(duplicate, {
      requestCreated: false,
      conversationCreated: false,
      previousConversationCount: 0,
    });

    const unknown = await recordChatRequest({
      requestId: randomUUID(),
      conversationId: unknownConversationId,
      visitorId: null,
      placement: "global",
    });

    assert.deepEqual(unknown, {
      requestCreated: true,
      conversationCreated: true,
      previousConversationCount: null,
    });

    await assert.rejects(
      () =>
        recordChatRequest({
          ...input,
          requestId: "invalid-uuid",
        }),
      { name: "ZodError" },
    );

    const completed = await completeChatRequest({
      requestId: input.requestId,
      status: "generated",
      generationDurationMs: 150,
    });

    assert.deepEqual(completed, { updated: true });

    const completedAgain = await completeChatRequest({
      requestId: input.requestId,
      status: "generated",
      generationDurationMs: 200,
    });

    assert.deepEqual(completedAgain, { updated: false });

    await assert.rejects(
      () =>
        completeChatRequest({
          requestId: input.requestId,
          status: "failed",
          generationDurationMs: null,
          errorStage: "model",
          errorCode: "model_error",
        }),
      { message: "Analytics request already has a different outcome." },
    );

    const saved = await getAnalyticsPool().query<{
      status: string;
      generation_duration_ms: number;
    }>(
      `SELECT status, generation_duration_ms
       FROM analytics.chat_requests
       WHERE request_id = $1::uuid`,
      [input.requestId],
    );

    assert.deepEqual(saved.rows[0], {
      status: "generated",
      generation_duration_ms: 150,
    });
  } finally {
    try {
      const pool = getAnalyticsPool();
      const conversationIds = [conversationId, unknownConversationId];

      await pool.query(
        `DELETE FROM analytics.chat_requests
         WHERE conversation_id = ANY($1::uuid[])`,
        [conversationIds],
      );

      await pool.query(
        `DELETE FROM analytics.conversations
         WHERE conversation_id = ANY($1::uuid[])`,
        [conversationIds],
      );

      await pool.query(
        `DELETE FROM analytics.browser_visitors
         WHERE visitor_id = $1::uuid`,
        [visitorId],
      );
    } finally {
      await closeAnalyticsPool();
    }
  }

  console.log("Analytics request recording: OK");
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics request recording: FAILED (${code})`);

  if (error instanceof assert.AssertionError) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
