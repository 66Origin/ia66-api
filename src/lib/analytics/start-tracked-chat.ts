import {
  isChatTrackingEnabled,
  startChatTracking,
  type ChatTrackingContext,
} from "./chat-tracking";
import type { ChatAnalyticsMetadata } from "./request-metadata";

export async function startTrackedChat(
  metadata: ChatAnalyticsMetadata | null,
): Promise<ChatTrackingContext | null> {
  if (!metadata || !isChatTrackingEnabled()) {
    return null;
  }

  return startChatTracking({
    requestId: metadata.requestId,
    conversationId: metadata.conversationId,
    placement: metadata.placement,
  });
}
