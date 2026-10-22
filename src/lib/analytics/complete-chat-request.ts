import { z } from "zod";
import { getAnalyticsPool } from "./db";

const durationSchema = z.number().int().min(0).max(2_147_483_647);

const inputSchema = z.discriminatedUnion("status", [
  z.object({
    requestId: z.uuid(),
    status: z.literal("generated"),
    generationDurationMs: durationSchema,
  }),
  z.object({
    requestId: z.uuid(),
    status: z.literal("failed"),
    generationDurationMs: durationSchema.nullable(),
    errorStage: z.enum(["model", "response_processing"]),
    errorCode: z.enum([
      "model_error",
      "empty_response",
      "response_processing_error",
    ]),
  }),
]);

export type CompleteChatRequestInput = z.infer<typeof inputSchema>;

export async function completeChatRequest(
  input: CompleteChatRequestInput,
): Promise<{ updated: boolean }> {
  const validated = inputSchema.parse(input);
  const pool = getAnalyticsPool();

  const result = await pool.query(
    `UPDATE analytics.chat_requests
     SET
       status = $2::text,
       completed_at = clock_timestamp(),
       generation_duration_ms = $3::integer,
       error_stage = $4::text,
       error_code = $5::text
     WHERE request_id = $1::uuid
       AND status = 'received'
     RETURNING request_id`,
    [
      validated.requestId,
      validated.status,
      validated.generationDurationMs,
      validated.status === "failed" ? validated.errorStage : null,
      validated.status === "failed" ? validated.errorCode : null,
    ],
  );

  if (result.rowCount === 1) {
    return { updated: true };
  }

  const existing = await pool.query<{ status: string }>(
    `SELECT status
     FROM analytics.chat_requests
     WHERE request_id = $1::uuid`,
    [validated.requestId],
  );

  const row = existing.rows[0];

  if (!row) {
    throw new Error("Analytics request does not exist.");
  }

  if (row.status !== validated.status) {
    throw new Error("Analytics request already has a different outcome.");
  }

  return { updated: false };
}
