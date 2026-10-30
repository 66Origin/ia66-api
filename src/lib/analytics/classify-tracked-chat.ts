import type { ChatRequest } from "../schema";
import {
  isChatTrackingEnabled,
  type ChatTrackingContext,
} from "./chat-tracking";
import { classifyChatRequest } from "./classify-chat-request";
import type { ClassificationOutcome } from "./classification";
import {
  recordClassification,
  type RecordClassificationInput,
} from "./record-classification";
import {
  keepUnansweredQuestion,
  recordUnansweredQuestion,
} from "./record-unanswered-question";

type ClassificationDependencies = {
  classify: (input: ChatRequest) => Promise<ClassificationOutcome>;
  record: (input: RecordClassificationInput) => Promise<{ created: boolean }>;
  recordUnanswered?: typeof recordUnansweredQuestion;
};

const defaultDependencies: ClassificationDependencies = {
  classify: classifyChatRequest,
  record: recordClassification,
  recordUnanswered: recordUnansweredQuestion,
};

export function isChatClassificationEnabled(): boolean {
  return (
    isChatTrackingEnabled() &&
    process.env.O_ANALYTICS_CLASSIFICATION_ENABLED === "true"
  );
}

export async function classifyTrackedChat(
  tracking: ChatTrackingContext | null,
  input: ChatRequest,
  dependencies: ClassificationDependencies = defaultDependencies,
): Promise<void> {
  if (!tracking || !isChatClassificationEnabled()) {
    return;
  }

  let outcome: ClassificationOutcome;

  try {
    outcome = await dependencies.classify(input);
  } catch {
    outcome = {
      status: "failed",
      subject: null,
      intent: null,
    };
  }

  try {
    await dependencies.record({
      requestId: tracking.requestId,
      outcome,
    });
  } catch {
    // Keep messages, history and raw errors out of analytics logs.
    console.error("[analytics] Could not record classification.");
  }

  if (outcome.status === "unclassifiable") {
    await keepUnansweredQuestion(
      tracking.requestId,
      input.message,
      "unclassifiable",
      dependencies.recordUnanswered ?? recordUnansweredQuestion,
    );
  }
}
