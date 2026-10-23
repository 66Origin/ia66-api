import {
  recordChatRequest,
  type RecordChatRequestInput,
} from "./record-chat-request";
import {
  completeChatRequest,
  type CompleteChatRequestInput,
} from "./complete-chat-request";

export type ChatTrackingContext = {
  requestId: string;
};

type ChatTrackingOutcome =
  | {
      status: "generated";
      generationDurationMs: number;
    }
  | {
      status: "failed";
      generationDurationMs: number | null;
      errorStage: "model" | "response_processing";
      errorCode: "model_error" | "empty_response" | "response_processing_error";
    };

export function isChatTrackingEnabled(): boolean {
  return process.env.O_ANALYTICS_ENABLED === "true";
}

export async function startChatTracking(
  input: RecordChatRequestInput,
): Promise<ChatTrackingContext | null> {
  if (!isChatTrackingEnabled()) {
    return null;
  }

  try {
    const result = await recordChatRequest(input);

    // Only the execution that created the request records its outcome.
    if (!result.requestCreated) {
      return null;
    }

    return { requestId: input.requestId };
  } catch {
    console.error("[analytics] Could not record chat request.");
    return null;
  }
}

export async function finishChatTracking(
  context: ChatTrackingContext | null,
  outcome: ChatTrackingOutcome,
): Promise<void> {
  if (!context) {
    return;
  }

  try {
    const input: CompleteChatRequestInput = {
      ...outcome,
      requestId: context.requestId,
    };

    await completeChatRequest(input);
  } catch {
    console.error("[analytics] Could not record chat outcome.");
  }
}
