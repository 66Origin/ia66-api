import assert from "node:assert/strict";
import { test } from "node:test";
import { chatRequestSchema } from "../src/lib/schema";
import { parseChatAnalyticsMetadata } from "../src/lib/analytics/request-metadata";

const metadata = {
  requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  conversationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  placement: "home" as const,
};

test("valid analytics metadata is extracted from a chat request", () => {
  const body = {
    message: "Que fait 66 Origin ?",
    conversation: { history: [] },
    analytics: metadata,
  };

  assert.deepEqual(parseChatAnalyticsMetadata(body), metadata);
  assert.equal(chatRequestSchema.safeParse(body).success, true);
});

test("existing requests remain valid without analytics metadata", () => {
  const body = {
    message: "Que fait 66 Origin ?",
    conversation: { history: [] },
  };

  assert.equal(parseChatAnalyticsMetadata(body), null);
  assert.equal(chatRequestSchema.safeParse(body).success, true);
});

test("invalid analytics metadata does not invalidate the chat message", () => {
  for (const analytics of [
    null,
    {},
    { ...metadata, requestId: "invalid" },
    { ...metadata, conversationId: "invalid" },
    { ...metadata, placement: "unknown" },
    { ...metadata, visitorId: metadata.requestId },
  ]) {
    const body = {
      message: "Que fait 66 Origin ?",
      analytics,
    };

    assert.equal(parseChatAnalyticsMetadata(body), null);
    assert.equal(chatRequestSchema.safeParse(body).success, true);
  }
});

test("malformed request bodies return no analytics metadata", () => {
  for (const body of [null, undefined, [], "invalid", 42]) {
    assert.equal(parseChatAnalyticsMetadata(body), null);
  }
});
