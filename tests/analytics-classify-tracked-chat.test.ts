import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTrackedChat } from "../src/lib/analytics/classify-tracked-chat";
import type { ClassificationOutcome } from "../src/lib/analytics/classification";
import type { RecordClassificationInput } from "../src/lib/analytics/record-classification";
import type { ChatRequest } from "../src/lib/schema";

const tracking = {
  requestId: "4b71212d-e73d-4fb1-9475-c92c0d9ace97",
};

const input: ChatRequest = {
  message: "Et pour Bewiz ?",
  conversation: {
    history: [
      {
        role: "user",
        text: "Quels projets avez-vous réalisés ?",
      },
      {
        role: "assistant",
        text: "Nous pouvons vous présenter plusieurs réalisations.",
      },
    ],
  },
};

const classified: ClassificationOutcome = {
  status: "classified",
  subject: "projects_references",
  intent: "explore_references",
};

const failed: ClassificationOutcome = {
  status: "failed",
  subject: null,
  intent: null,
};

async function withFlags(
  analytics: string,
  classification: string,
  operation: () => Promise<void>,
) {
  const previousAnalytics = process.env.O_ANALYTICS_ENABLED;
  const previousClassification = process.env.O_ANALYTICS_CLASSIFICATION_ENABLED;

  process.env.O_ANALYTICS_ENABLED = analytics;
  process.env.O_ANALYTICS_CLASSIFICATION_ENABLED = classification;

  try {
    await operation();
  } finally {
    if (previousAnalytics === undefined) {
      delete process.env.O_ANALYTICS_ENABLED;
    } else {
      process.env.O_ANALYTICS_ENABLED = previousAnalytics;
    }

    if (previousClassification === undefined) {
      delete process.env.O_ANALYTICS_CLASSIFICATION_ENABLED;
    } else {
      process.env.O_ANALYTICS_CLASSIFICATION_ENABLED = previousClassification;
    }
  }
}

function createDependencies(outcome: ClassificationOutcome = classified) {
  const classifiedInputs: ChatRequest[] = [];
  const recordedInputs: RecordClassificationInput[] = [];

  return {
    classifiedInputs,
    recordedInputs,
    dependencies: {
      classify: async (value: ChatRequest) => {
        classifiedInputs.push(value);
        return outcome;
      },
      record: async (value: RecordClassificationInput) => {
        recordedInputs.push(value);
        return { created: true };
      },
    },
  };
}

for (const [analytics, classification] of [
  ["false", "false"],
  ["true", "false"],
  ["false", "true"],
]) {
  test(`does nothing with flags ${analytics}/${classification}`, async () => {
    await withFlags(analytics, classification, async () => {
      const fake = createDependencies();

      await classifyTrackedChat(tracking, input, fake.dependencies);

      assert.equal(fake.classifiedInputs.length, 0);
      assert.equal(fake.recordedInputs.length, 0);
    });
  });
}

test("does nothing without a newly tracked request", async () => {
  await withFlags("true", "true", async () => {
    const fake = createDependencies();

    await classifyTrackedChat(null, input, fake.dependencies);

    assert.equal(fake.classifiedInputs.length, 0);
    assert.equal(fake.recordedInputs.length, 0);
  });
});

test("classifies with history and records the matching request", async () => {
  await withFlags("true", "true", async () => {
    const fake = createDependencies();

    await classifyTrackedChat(tracking, input, fake.dependencies);

    assert.deepEqual(fake.classifiedInputs, [input]);
    assert.deepEqual(fake.recordedInputs, [
      {
        requestId: tracking.requestId,
        outcome: classified,
      },
    ]);
  });
});

test("records a technical failure returned by the classifier", async () => {
  await withFlags("true", "true", async () => {
    const fake = createDependencies(failed);

    await classifyTrackedChat(tracking, input, fake.dependencies);

    assert.deepEqual(fake.recordedInputs, [
      {
        requestId: tracking.requestId,
        outcome: failed,
      },
    ]);
  });
});

test("converts an unexpected classifier exception into failed", async () => {
  await withFlags("true", "true", async () => {
    const fake = createDependencies();

    await classifyTrackedChat(tracking, input, {
      ...fake.dependencies,
      classify: async () => {
        throw new Error("Simulated classifier failure");
      },
    });

    assert.deepEqual(fake.recordedInputs, [
      {
        requestId: tracking.requestId,
        outcome: failed,
      },
    ]);
  });
});

test("contains database errors and logs only a generic message", async () => {
  await withFlags("true", "true", async () => {
    const fake = createDependencies();
    const logs: unknown[][] = [];
    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      logs.push(args);
    };

    try {
      await assert.doesNotReject(() =>
        classifyTrackedChat(tracking, input, {
          ...fake.dependencies,
          record: async () => {
            throw new Error("Simulated sensitive database details");
          },
        }),
      );

      assert.deepEqual(logs, [
        ["[analytics] Could not record classification."],
      ]);
    } finally {
      console.error = originalError;
    }
  });
});
