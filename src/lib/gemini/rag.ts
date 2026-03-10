// src/lib/gemini/rag.ts
import { SYSTEM_CONTEXT } from "../bot/system";
import { getGeminiClient } from "./client";

export type RagChatInput = {
  model?: string; // ex: "gemini-2.5-flash"
  prompt: string;
  fileSearchStoreNames: string[]; // ex: ["fileSearchStores/xxx"] ou ["xxx"]
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

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    config: {
      systemInstruction: SYSTEM_CONTEXT,
      temperature: 0.35,
      topP: 0.9,
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: storeNames,
          },
        },
      ],
    },
  });

  const text =
    response?.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim() || "";

  if (!text) throw new Error("Gemini response has no text output");
  return { text };
}
