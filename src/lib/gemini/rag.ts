// src/lib/gemini/rag.ts
import { SYSTEM_CONTEXT } from "../bot/system";
import { getGeminiClient } from "./client";

export type RagChatInput = {
  model?: string;
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  fileSearchStoreNames: string[];
};

function normalizeStoreName(name: string) {
  return name.startsWith("fileSearchStores/")
    ? name
    : `fileSearchStores/${name}`;
}

/**
 * Exécute un appel Gemini avec File Search tool activé.
 * Retourne le texte brut.
 */
export async function runRagChat(
  input: RagChatInput,
): Promise<{ text: string }> {
  const ai = getGeminiClient();

  const model = input.model ?? "gemini-2.5-flash";
  const storeNames = input.fileSearchStoreNames.map(normalizeStoreName);

  const contents = [
    ...(input.history ?? []).slice(-3).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    {
      role: "user",
      parts: [{ text: input.prompt }],
    },
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: SYSTEM_CONTEXT,
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 340,
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: storeNames,
          },
        },
      ],
    },
  });

  console.log("RAW GEMINI RESPONSE:", JSON.stringify(response, null, 2));

  const candidate = response?.candidates?.[0];

  if (!candidate) {
    throw new Error("Gemini returned no candidate");
  }

  let text = "";

  console.log(candidate.finishReason);

  if (candidate.content?.parts?.length) {
    text = candidate.content.parts
      .filter((p: any) => typeof p?.text === "string")
      .map((p: any) => p.text)
      .join("")
      .trim();
  }

  if (!text && typeof response?.text === "string") {
    text = response.text.trim();
  }

  if (!text) {
    console.error("Gemini empty candidate:", candidate);
    return {
      text: "Je reformule : peux-tu préciser légèrement ce point ?",
    };
  }

  return { text };
}
