// src/lib/bot/prompt.ts

export type BuildChatPromptInput = {
  message: string;
  latestInsightsContext?: string;
};

function clip(s: string, max = 500): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message, latestInsightsContext } = input;

  return `
RÈGLES LOCALES
- Pour toute question factuelle sur 66 Origin : s’appuyer d’abord sur le contenu RAG.
- Si plusieurs projets sont cités : répondre brièvement sur chacun avant de relier.
- Ne jamais extrapoler à partir d’un projet proche.
${
  latestInsightsContext
    ? `
- Pour cette question de fraîcheur, utiliser la liste structurée ci-dessous comme référence chronologique autoritative.
- Ne pas déterminer le plus récent à partir du classement File Search.
- Si la réponse cite un Insight précis, inclure son URL canonique à la fin de la réponse.
- Utiliser uniquement la valeur 'canonical_url' fournie dans le contexte structuré.

INSIGHTS RÉCENTS — ORDRE CHRONOLOGIQUE DÉCROISSANT
${latestInsightsContext}
`
    : ""
}

MESSAGE UTILISATEUR
${clip(message, 1200)}

SORTIE
- Texte brut uniquement
- Réponse complète, jamais coupée
- Une seule réponse
`.trim();
}
