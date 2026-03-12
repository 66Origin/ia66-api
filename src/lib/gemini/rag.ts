// src/lib/gemini/rag.ts
import { SYSTEM_CONTEXT, RULES } from "../bot/system";
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
    ...(input.history ?? []).slice(-4).map((m) => ({
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
      systemInstruction: SYSTEM_CONTEXT + "\n\n" + RULES,
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 950,
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

  let text =
    candidate.content?.parts
      ?.filter((p: any) => typeof p?.text === "string")
      .map((p: any) => p.text)
      .join("")
      .trim() ?? "";

  if (!text && typeof response?.text === "string") {
    text = response.text.trim();
  }

  if (!text) {
    console.error("Candidate:", JSON.stringify(candidate, null, 2));
    throw new Error("Gemini response has no text output");
  }

  return { text };
}
