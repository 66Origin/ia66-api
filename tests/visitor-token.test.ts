import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createVisitorToken,
  verifyVisitorToken,
} from "../src/lib/analytics/visitor-token";

test("visitor tokens verify identity, signature and expiration", async (t) => {
  const previousSecret = process.env.O_ANALYTICS_VISITOR_SECRET;

  // Test-only keys, unrelated to the actual local signing key.
  const testSecret = "a".repeat(64);
  const otherSecret = "b".repeat(64);

  const visitorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherVisitorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const expiresAt = Date.now() + 60_000;

  process.env.O_ANALYTICS_VISITOR_SECRET = testSecret;

  try {
    const token = createVisitorToken(visitorId, expiresAt);

    await t.test("a valid token returns its visitor and expiration", () => {
      assert.deepEqual(verifyVisitorToken(token), {
        visitorId,
        expiresAt,
      });
    });

    await t.test("changing the visitor invalidates the signature", () => {
      const modified = token.replace(visitorId, otherVisitorId);

      assert.equal(verifyVisitorToken(modified), null);
    });

    await t.test("changing the expiration invalidates the signature", () => {
      const modified = token.replace(
        String(expiresAt),
        String(expiresAt + 60_000),
      );

      assert.equal(verifyVisitorToken(modified), null);
    });

    await t.test("changing the signature invalidates the token", () => {
      const parts = token.split(".");
      const signature = parts[3];

      parts[3] = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

      assert.equal(verifyVisitorToken(parts.join(".")), null);
    });

    await t.test("a token expires exactly at its expiration", (t) => {
      const clock = t.mock.method(Date, "now", () => expiresAt);

      try {
        assert.equal(verifyVisitorToken(token), null);
      } finally {
        clock.mock.restore();
      }
    });

    await t.test("another signing key rejects the token", () => {
      process.env.O_ANALYTICS_VISITOR_SECRET = otherSecret;

      try {
        assert.equal(verifyVisitorToken(token), null);
      } finally {
        process.env.O_ANALYTICS_VISITOR_SECRET = testSecret;
      }
    });

    await t.test("malformed tokens are ignored without throwing", () => {
      for (const value of [
        null,
        undefined,
        42,
        {},
        "",
        "invalid",
        "x".repeat(201),
        token.replace("v1.", "v2."),
      ]) {
        assert.equal(verifyVisitorToken(value), null);
      }
    });

    await t.test("a missing key prevents creation and recognition", () => {
      delete process.env.O_ANALYTICS_VISITOR_SECRET;

      try {
        assert.throws(
          () => createVisitorToken(visitorId, expiresAt),
          /O_ANALYTICS_VISITOR_SECRET/,
        );

        assert.equal(verifyVisitorToken(token), null);
      } finally {
        process.env.O_ANALYTICS_VISITOR_SECRET = testSecret;
      }
    });

    await t.test("creation rejects an already expired token", () => {
      assert.throws(
        () => createVisitorToken(visitorId, Date.now() - 1),
        /expiration must be in the future/,
      );
    });
  } finally {
    if (previousSecret === undefined) {
      delete process.env.O_ANALYTICS_VISITOR_SECRET;
    } else {
      process.env.O_ANALYTICS_VISITOR_SECRET = previousSecret;
    }
  }
});
