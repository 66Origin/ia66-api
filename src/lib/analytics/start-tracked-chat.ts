import {
  isChatTrackingEnabled,
  startChatTracking,
  type ChatTrackingContext,
} from "./chat-tracking";
import type { ChatAnalyticsMetadata } from "./request-metadata";
import { registerVisitor } from "./register-visitor";

export async function startTrackedChat(
  metadata: ChatAnalyticsMetadata | null,
): Promise<ChatTrackingContext | null> {
  if (!metadata || !isChatTrackingEnabled()) {
    return null;
  }

  try {
    const visitor = await registerVisitor(metadata.visitorToken);

    return await startChatTracking({
      requestId: metadata.requestId,
      conversationId: metadata.conversationId,
      placement: metadata.placement,
      visitorId: visitor?.visitorId ?? null,
    });
  } catch {
    // Do not misclassify a recognized visitor when registration fails.
    console.error("[analytics] Could not prepare visitor recognition.");
    return null;
  }
}
