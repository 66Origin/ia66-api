import { z } from "zod";
import { getAnalyticsPool } from "./db";

const inputSchema = z.object({
  requestId: z.uuid(),
  conversationId: z.uuid(),
  visitorId: z.uuid().nullable(),
  placement: z.enum(["home", "global"]),
});

export type RecordChatRequestInput = z.infer<typeof inputSchema>;

type DatabaseResult = {
  request_created: boolean;
  conversation_created: boolean;
  previous_conversation_count: number | null;
};

export type RecordChatRequestResult = {
  requestCreated: boolean;
  conversationCreated: boolean;
  previousConversationCount: number | null;
};

export async function recordChatRequest(
  input: RecordChatRequestInput,
): Promise<RecordChatRequestResult> {
  const validated = inputSchema.parse(input);

  const result = await getAnalyticsPool().query<DatabaseResult>(
    `SELECT *
     FROM analytics.record_chat_request(
       $1::uuid,
       $2::uuid,
       $3::uuid,
       $4::text
     )`,
    [
      validated.requestId,
      validated.conversationId,
      validated.visitorId,
      validated.placement,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Analytics request recording returned no result.");
  }

  return {
    requestCreated: row.request_created,
    conversationCreated: row.conversation_created,
    previousConversationCount: row.previous_conversation_count,
  };
}
