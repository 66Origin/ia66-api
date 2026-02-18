// src/lib/gemini/rag.ts
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
      tools: [{ fileSearch: { fileSearchStoreNames: [...storeNames] } }],
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
