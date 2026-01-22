import { SYSTEM_CONTEXT } from "./system";

export type BuildBotPromptInput = {
  description: string;
  tags: string[];
};

export function buildBotPrompt(input: BuildBotPromptInput): string {
  const { description, tags } = input;

  return `
${SYSTEM_CONTEXT}

Brief prospect :
${description}

Tags (si présents) :
${tags.length ? tags.join(", ") : "—"}
`.trim();
}
