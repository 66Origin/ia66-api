import { getFileSearchStoreName, runRagChat } from "@/lib/gemini";
import { buildBotPrompt } from "./prompt";

export type RunBotInput = {
  description: string;
  tags: string[];
  model?: string;
};

export async function runBot(input: RunBotInput): Promise<{ text: string }> {
  const storeName = getFileSearchStoreName();
  const prompt = buildBotPrompt({
    description: input.description,
    tags: input.tags,
  });

  return runRagChat({
    model: input.model ?? "gemini-2.5-flash",
    prompt,
    fileSearchStoreNames: [storeName],
  });
}
