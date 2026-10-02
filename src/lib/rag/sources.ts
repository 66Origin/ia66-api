import type { RagSource } from "@/lib/gemini/rag";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function selectVisibleSources(
  message: string,
  sources: RagSource[],
): RagSource[] {
  if (sources.length === 0) {
    return [];
  }

  const normalized = normalize(message);

  const asksForSource =
    normalized.includes("source") ||
    normalized.includes("lien") ||
    normalized.includes("url") ||
    normalized.includes("ou voir") ||
    normalized.includes("ou trouver");

  if (asksForSource) {
    return sources;
  }

  const asksSpecificInsight =
    sources.some((source) => source.type === "insight") &&
    (normalized.includes("resume") ||
      normalized.includes("resumer") ||
      normalized.includes("parle-moi de l'insight") ||
      normalized.includes("parle moi de l'insight"));

  if (asksSpecificInsight) {
    return sources.filter((source) => source.type === "insight");
  }

  return [];
}
