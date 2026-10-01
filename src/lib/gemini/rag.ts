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

function ensureCompleteSentence(text: string, finishReason?: string): string {
  if (!text) return text;

  const trimmed = text.trim();

  // Gemini indique que la génération s'est terminée normalement :
  // ne surtout pas modifier le contenu.
  if (finishReason === "STOP") {
    return trimmed;
  }

  // La réponse se termine déjà proprement.
  if (/[.!?»"]$/.test(trimmed)) {
    return trimmed;
  }

  // Ne considérer comme fin de phrase qu'une ponctuation
  // suivie d'un espace ou de la fin du texte.
  const sentenceEndRegex = /[.!?](?=\s|$)/g;
  const matches = [...trimmed.matchAll(sentenceEndRegex)];

  if (matches.length === 0) {
    return trimmed;
  }

  const lastMatch = matches[matches.length - 1];
  const endIndex = (lastMatch.index ?? 0) + 1;
  const complete = trimmed.slice(0, endIndex).trim();

  return complete.length > 40 ? complete : trimmed;
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
    ...(input.history ?? []).slice(-10).map((m) => ({
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
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: storeNames,
          },
        },
      ],
    },
  });

  const candidate = response?.candidates?.[0];

  if (!candidate) {
    throw new Error("Gemini returned no candidate");
  }

  let text = "";

  if (candidate.content?.parts?.length) {
    const parts = candidate.content.parts;

    text = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  if (!text && typeof response?.text === "string") {
    text = response.text.trim();
  }

  if (!text) {
    console.error("Gemini empty candidate:", candidate);
    throw new Error("Empty model response");
  }

  const finalText = ensureCompleteSentence(text, candidate.finishReason);

  console.log(candidate.finishReason);

  return { text: finalText };
}
