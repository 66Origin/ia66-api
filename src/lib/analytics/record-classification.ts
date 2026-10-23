import { z } from "zod";
import {
  CLASSIFICATION_VERSION,
  classificationOutcomeSchema,
} from "./classification";
import { getAnalyticsPool } from "./db";
import type { PoolClient } from "pg";

const inputSchema = z.strictObject({
  requestId: z.uuid(),
  outcome: classificationOutcomeSchema,
});

export type RecordClassificationInput = z.infer<typeof inputSchema>;

type StoredClassification = {
  subject: string | null;
  intent: string | null;
  classification_status: string;
  classification_version: string;
};

export async function recordClassification(
  input: RecordClassificationInput,
  database?: Pick<PoolClient, "query">,
): Promise<{ created: boolean }> {
  const { requestId, outcome } = inputSchema.parse(input);
  const pool = database ?? getAnalyticsPool();

  const result = await pool.query(
    `INSERT INTO analytics.request_classifications (
       request_id,
       subject,
       intent,
       classification_status,
       classification_version,
       classified_at
     )
     VALUES (
       $1::uuid,
       $2::text,
       $3::text,
       $4::text,
       $5::text,
       CASE
         WHEN $4::text = 'failed' THEN NULL
         ELSE clock_timestamp()
       END
     )
     ON CONFLICT (request_id) DO NOTHING
     RETURNING request_id`,
    [
      requestId,
      outcome.subject,
      outcome.intent,
      outcome.status,
      CLASSIFICATION_VERSION,
    ],
  );

  if (result.rowCount === 1) {
    return { created: true };
  }

  const existing = await pool.query<StoredClassification>(
    `SELECT
       subject,
       intent,
       classification_status,
       classification_version
     FROM analytics.request_classifications
     WHERE request_id = $1::uuid`,
    [requestId],
  );

  const saved = existing.rows[0];

  if (!saved) {
    throw new Error("Analytics classification could not be found.");
  }

  const matches =
    saved.subject === outcome.subject &&
    saved.intent === outcome.intent &&
    saved.classification_status === outcome.status &&
    saved.classification_version === CLASSIFICATION_VERSION;

  if (!matches) {
    throw new Error(
      "Analytics request already has a different classification.",
    );
  }

  return { created: false };
}
