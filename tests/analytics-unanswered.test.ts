import assert from "node:assert/strict";
import { test } from "node:test";
import { redactContactDetails } from "../src/lib/analytics/redact-contact-details";
import {
  isUnansweredRecordingEnabled,
  keepUnansweredQuestion,
  recordUnansweredQuestion,
  type RecordUnansweredQuestionInput,
} from "../src/lib/analytics/record-unanswered-question";

const requestId = "4b71212d-e73d-4fb1-9475-c92c0d9ace97";

async function withFlags(
  analytics: string | undefined,
  unanswered: string | undefined,
  operation: () => Promise<void> | void,
) {
  const previous = {
    analytics: process.env.O_ANALYTICS_ENABLED,
    unanswered: process.env.O_ANALYTICS_UNANSWERED_ENABLED,
  };

  const set = (name: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };

  set("O_ANALYTICS_ENABLED", analytics);
  set("O_ANALYTICS_UNANSWERED_ENABLED", unanswered);

  try {
    await operation();
  } finally {
    set("O_ANALYTICS_ENABLED", previous.analytics);
    set("O_ANALYTICS_UNANSWERED_ENABLED", previous.unanswered);
  }
}

test("e-mail addresses and phone numbers are masked", () => {
  assert.equal(
    redactContactDetails("Écrivez à jean.dupont@exemple.fr ou marie+o@agence.co.uk"),
    "Écrivez à [email] ou [email]",
  );

  for (const phone of [
    "06 12 34 56 78",
    "06.12.34.56.78",
    "+33 6 12 34 56 78",
    "0033612345678",
    "(01) 45-67-89-10",
  ]) {
    assert.equal(redactContactDetails(`Appelez le ${phone}.`), "Appelez le [téléphone].");
  }
});

test("ordinary numbers are kept", () => {
  for (const text of [
    "Budget de 15 000 € pour 2025",
    "Projet de 2024 à 2026 avec 120 pages",
    "Référence 1234567 du devis",
  ]) {
    assert.equal(redactContactDetails(text), text);
  }
});

test("recording requires both analytics flags set to true", async () => {
  for (const [analytics, unanswered] of [
    [undefined, undefined],
    ["true", undefined],
    ["true", "false"],
    ["false", "true"],
    ["true", "TRUE"],
  ]) {
    await withFlags(analytics, unanswered, () => {
      assert.equal(isUnansweredRecordingEnabled(), false);
    });
  }

  await withFlags("true", "true", () => {
    assert.equal(isUnansweredRecordingEnabled(), true);
  });
});

test("invalid input is rejected before any database access", async () => {
  await assert.rejects(
    () =>
      recordUnansweredQuestion({
        requestId: "invalid",
        question: "Question",
        reason: "unclassifiable",
      }),
    { name: "ZodError" },
  );

  await assert.rejects(
    () =>
      recordUnansweredQuestion({
        requestId,
        question: "   ",
        reason: "unclassifiable",
      }),
    { name: "ZodError" },
  );
});

test("nothing is recorded when the flag is off", async () => {
  await withFlags("true", "false", async () => {
    const recorded: RecordUnansweredQuestionInput[] = [];

    await keepUnansweredQuestion(requestId, "Question", "empty_response", async (input) => {
      recorded.push(input);
      return { created: true };
    });

    assert.deepEqual(recorded, []);
  });
});

test("the question is recorded when enabled", async () => {
  await withFlags("true", "true", async () => {
    const recorded: RecordUnansweredQuestionInput[] = [];

    await keepUnansweredQuestion(requestId, "Question", "generation_failed", async (input) => {
      recorded.push(input);
      return { created: true };
    });

    assert.deepEqual(recorded, [
      { requestId, question: "Question", reason: "generation_failed" },
    ]);
  });
});

test("recording errors are contained without logging the question", async () => {
  await withFlags("true", "true", async () => {
    const logs: unknown[][] = [];
    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      logs.push(args);
    };

    try {
      await assert.doesNotReject(() =>
        keepUnansweredQuestion(requestId, "Question sensible", "unclassifiable", async () => {
          throw new Error("Simulated database error");
        }),
      );
    } finally {
      console.error = originalError;
    }

    assert.deepEqual(logs, [["[analytics] Could not record unanswered question."]]);
  });
});
