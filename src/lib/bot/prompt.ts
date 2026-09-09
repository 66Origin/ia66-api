// src/lib/bot/prompt.ts

export type BuildChatPromptInput = {
  message: string;
};

function clip(s: string, max = 500): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message } = input;

  return `
RÈGLES LOCALES
- Pour toute question factuelle sur 66 Origin : s’appuyer d’abord sur le contenu RAG.
- Si plusieurs projets sont cités : répondre brièvement sur chacun avant de relier.
- Ne jamais extrapoler à partir d’un projet proche.

MESSAGE UTILISATEUR
${clip(message, 1200)}

SORTIE
- Texte brut uniquement
- Réponse complète, jamais coupée
- Une seule réponse
`.trim();
}
