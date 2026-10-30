import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finishChatTracking,
  isChatTrackingEnabled,
  startChatTracking,
} from "../src/lib/analytics/chat-tracking";

test("chat tracking stays optional and contains recording errors", async (t) => {
  const previousEnabled = process.env.O_ANALYTICS_ENABLED;

  // Invalid identifiers ensure that validation fails before any database access.
  const invalidInput = {
    requestId: "invalid-request-id",
    conversationId: "invalid-conversation-id",
    placement: "home" as const,
  };

  try {
    await t.test("tracking is disabled by default", () => {
      delete process.env.O_ANALYTICS_ENABLED;

      assert.equal(isChatTrackingEnabled(), false);
    });

    await t.test("only the explicit value true enables tracking", () => {
      for (const value of ["false", "", "1", "TRUE"]) {
        process.env.O_ANALYTICS_ENABLED = value;
        assert.equal(isChatTrackingEnabled(), false);
      }

      process.env.O_ANALYTICS_ENABLED = "true";
      assert.equal(isChatTrackingEnabled(), true);
    });

    await t.test("disabled tracking skips recording entirely", async (t) => {
      process.env.O_ANALYTICS_ENABLED = "false";
      const log = t.mock.method(console, "error", () => {});

      try {
        const context = await startChatTracking(invalidInput);

        assert.equal(context, null);
        assert.equal(log.mock.callCount(), 0);
      } finally {
        log.mock.restore();
      }
    });

    await t.test(
      "a recording error returns null with a generic log",
      async (t) => {
        process.env.O_ANALYTICS_ENABLED = "true";
        const log = t.mock.method(console, "error", () => {});

        try {
          const context = await startChatTracking(invalidInput);

          assert.equal(context, null);
          assert.equal(log.mock.callCount(), 1);
          assert.deepEqual(log.mock.calls[0].arguments, [
            "[analytics] Could not record chat request.",
          ]);
        } finally {
          log.mock.restore();
        }
      },
    );

    await t.test("an absent context skips completion", async (t) => {
      const log = t.mock.method(console, "error", () => {});

      try {
        await finishChatTracking(null, {
          status: "generated",
          generationDurationMs: 100,
        });

        assert.equal(log.mock.callCount(), 0);
      } finally {
        log.mock.restore();
      }
    });

    await t.test(
      "a completion error is contained with a generic log",
      async (t) => {
        const log = t.mock.method(console, "error", () => {});

        try {
          await finishChatTracking(
            { requestId: "invalid-request-id" },
            {
              status: "generated",
              generationDurationMs: 100,
            },
          );

          assert.equal(log.mock.callCount(), 1);
          assert.deepEqual(log.mock.calls[0].arguments, [
            "[analytics] Could not record chat outcome.",
          ]);
        } finally {
          log.mock.restore();
        }
      },
    );
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.O_ANALYTICS_ENABLED;
    } else {
      process.env.O_ANALYTICS_ENABLED = previousEnabled;
    }
  }
});
