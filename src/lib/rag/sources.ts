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

  const teamSources = sources.filter(
    (source) => source.type === "team" && source.title,
  );

  const exactTeamMatches = teamSources.filter((source) =>
    normalized.includes(normalize(source.title!)),
  );

  if (exactTeamMatches.length > 0) {
    return exactTeamMatches;
  }

  const messageWords = new Set(normalized.split(/\s+/));

  const firstNameMatches = teamSources.filter((source) => {
    const firstName = normalize(source.title!).split(/\s+/)[0];
    return firstName && messageWords.has(firstName);
  });

  if (firstNameMatches.length === 1) {
    return firstNameMatches;
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

  if (sources.length === 1 && sources[0]?.type === "insight") {
    return sources;
  }

  return [];
}
