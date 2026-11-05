import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClassificationContext } from "../src/lib/analytics/classify-chat-request";

test("only a minimal context is sent to the classifier", () => {
  const context = buildClassificationContext({
    message: "Le second",
    conversation: {
      history: [
        { role: "user", text: "Première question" },
        { role: "assistant", text: "Première réponse" },
        { role: "user", text: "Deuxième question" },
        { role: "assistant", text: "Deuxième réponse" },
        { role: "user", text: "Troisième question" },
        { role: "assistant", text: "x".repeat(800) },
      ],
    },
  });

  assert.deepEqual(context, {
    previousUserMessages: ["Deuxième question", "Troisième question"],
    lastAssistantReply: "x".repeat(500),
    message: "Le second",
  });
});

test("an empty history produces an empty context", () => {
  assert.deepEqual(
    buildClassificationContext({
      message: "Que fait 66 Origin ?",
      conversation: { history: [] },
    }),
    {
      previousUserMessages: [],
      lastAssistantReply: null,
      message: "Que fait 66 Origin ?",
    },
  );
});
