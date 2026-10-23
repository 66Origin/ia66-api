import { getAnalyticsPool } from "./db";
import { verifyVisitorToken, type RecognizedVisitor } from "./visitor-token";

export async function registerVisitor(
  token: unknown,
): Promise<RecognizedVisitor | null> {
  const visitor = verifyVisitorToken(token);

  if (!visitor) {
    return null;
  }

  const expiresAt = new Date(visitor.expiresAt).toISOString();

  const result = await getAnalyticsPool().query(
    `INSERT INTO analytics.browser_visitors AS existing (
       visitor_id,
       recognition_expires_at
     )
     SELECT $1::uuid, $2::timestamptz
     WHERE $2::timestamptz > clock_timestamp()
     ON CONFLICT (visitor_id) DO UPDATE
       SET last_seen_at = clock_timestamp()
       WHERE existing.recognition_expires_at =
             EXCLUDED.recognition_expires_at
         AND existing.recognition_expires_at > clock_timestamp()
     RETURNING visitor_id`,
    [visitor.visitorId, expiresAt],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      "Visitor recognition expiration is inconsistent or expired.",
    );
  }

  return visitor;
}
