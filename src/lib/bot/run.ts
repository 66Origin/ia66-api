// src/lib/run.ts
import { getFileSearchStoreName, runRagChat } from "@/lib/gemini";
import { buildChatPrompt } from "@/lib/bot/prompt";
import type { ChatRequest } from "@/lib/schema";

export type RunChatInput = Pick<
  ChatRequest,
  "message" | "entrypoint" | "pageContext" | "conversation"
> & {
  model?: string;
};

export async function runChat(input: RunChatInput): Promise<{ text: string }> {
  const storeName = getFileSearchStoreName();

  const prompt = buildChatPrompt({
    message: input.message,
    entrypoint: input.entrypoint,
    pageContext: input.pageContext,
    conversation: input.conversation,
  });

  return runRagChat({
    model: input.model ?? "gemini-2.5-flash",
    prompt,
    fileSearchStoreNames: [storeName],
  });
}
