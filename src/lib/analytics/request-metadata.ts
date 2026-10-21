import { z } from "zod";

const metadataSchema = z
  .object({
    requestId: z.uuid(),
    conversationId: z.uuid(),
    placement: z.enum(["home", "global"]),
    visitorToken: z.string().max(200).optional().catch(undefined),
  })
  .strict();

const envelopeSchema = z.object({
  analytics: metadataSchema,
});

export type ChatAnalyticsMetadata = z.infer<typeof metadataSchema>;

export function parseChatAnalyticsMetadata(
  body: unknown,
): ChatAnalyticsMetadata | null {
  const result = envelopeSchema.safeParse(body);

  return result.success ? result.data.analytics : null;
}
