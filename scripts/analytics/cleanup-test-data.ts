import { readFileSync } from "node:fs";
import { Pool } from "pg";

/**
 * The writer role used by the API cannot delete anything. Check scripts that
 * commit test data remove it through a separate connection, configured only
 * on developer machines with O_ANALYTICS_CLEANUP_DATABASE_URL (for example
 * the database owner of the development project).
 *
 * Without that variable, the data is kept and its IDs are printed.
 */
export async function deleteTestConversations(
  conversationIds: string[],
): Promise<void> {
  const ids = [...new Set(conversationIds)];
  const connectionString = process.env.O_ANALYTICS_CLEANUP_DATABASE_URL;

  if (!connectionString) {
    console.warn(
      "Test data kept: O_ANALYTICS_CLEANUP_DATABASE_URL is not set.",
    );
    console.warn(`Test conversation IDs: ${ids.join(", ")}`);
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      ca: readFileSync("certs/supabase-ca.crt", "utf8"),
      rejectUnauthorized: true,
    },
    max: 1,
    connectionTimeoutMillis: 2_000,
  });

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `DELETE FROM analytics.request_classifications
         WHERE request_id IN (
           SELECT request_id
           FROM analytics.chat_requests
           WHERE conversation_id = ANY($1::uuid[])
         )`,
        [ids],
      );

      await client.query(
        `DELETE FROM analytics.chat_requests
         WHERE conversation_id = ANY($1::uuid[])`,
        [ids],
      );

      await client.query(
        `DELETE FROM analytics.conversations
         WHERE conversation_id = ANY($1::uuid[])`,
        [ids],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
