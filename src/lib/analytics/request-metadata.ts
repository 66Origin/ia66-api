import { z } from "zod";

const metadataSchema = z
  .object({
    requestId: z.uuid(),
    conversationId: z.uuid(),
    placement: z.enum(["home", "global"]),
    // Browser recognition was removed. A cached ia.js may still send a
    // token for a while: accept it so the request is counted, then drop it.
    visitorToken: z.unknown().optional(),
  })
  .strict()
  .transform(({ requestId, conversationId, placement }) => ({
    requestId,
    conversationId,
    placement,
  }));

const envelopeSchema = z.object({
  analytics: metadataSchema,
});

export type ChatAnalyticsMetadata = z.output<typeof metadataSchema>;

export function parseChatAnalyticsMetadata(
  body: unknown,
): ChatAnalyticsMetadata | null {
  const result = envelopeSchema.safeParse(body);

  return result.success ? result.data.analytics : null;
}
