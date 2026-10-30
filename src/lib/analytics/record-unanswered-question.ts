import { z } from "zod";
import type { PoolClient } from "pg";
import { isChatTrackingEnabled } from "./chat-tracking";
import { getAnalyticsPool } from "./db";
import { redactContactDetails } from "./redact-contact-details";

export const UNANSWERED_REASONS = [
  "generation_failed",
  "empty_response",
  "unclassifiable",
] as const;

export type UnansweredReason = (typeof UNANSWERED_REASONS)[number];

const inputSchema = z.strictObject({
  requestId: z.uuid(),
  question: z.string().trim().min(1).max(2000),
  reason: z.enum(UNANSWERED_REASONS),
});

export type RecordUnansweredQuestionInput = z.infer<typeof inputSchema>;

const UNIQUE_VIOLATION = "23505";

export function isUnansweredRecordingEnabled(): boolean {
  return (
    isChatTrackingEnabled() &&
    process.env.O_ANALYTICS_UNANSWERED_ENABLED === "true"
  );
}

/**
 * Stores the current message of a request O could not answer or classify.
 * The writer role may insert these questions but never read them, so a
 * duplicate is detected through the primary key instead of ON CONFLICT,
 * which would require SELECT.
 */
export async function recordUnansweredQuestion(
  input: RecordUnansweredQuestionInput,
  database?: Pick<PoolClient, "query">,
): Promise<{ created: boolean }> {
  const { requestId, question, reason } = inputSchema.parse(input);
  const redacted = redactContactDetails(question);

  try {
    await (database ?? getAnalyticsPool()).query(
      `INSERT INTO analytics.unanswered_questions (
         request_id,
         question,
         reason
       )
       VALUES ($1::uuid, $2::text, $3::text)`,
      [requestId, redacted, reason],
    );

    return { created: true };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === UNIQUE_VIOLATION
    ) {
      // The first reason recorded for a request is kept.
      return { created: false };
    }

    throw error;
  }
}

/**
 * Never throws and never logs the question.
 */
export async function keepUnansweredQuestion(
  requestId: string,
  question: string,
  reason: UnansweredReason,
  record: typeof recordUnansweredQuestion = recordUnansweredQuestion,
): Promise<void> {
  if (!isUnansweredRecordingEnabled()) {
    return;
  }

  try {
    await record({ requestId, question, reason });
  } catch {
    console.error("[analytics] Could not record unanswered question.");
  }
}
