// src/lib/bot/prompt.ts

type PageContext = {
  pageType?:
    | "home"
    | "services"
    | "method"
    | "works"
    | "case"
    | "team"
    | "news"
    | "news_article"
    | "careers"
    | "contact"
    | "other";
  pageSlug?: string;
  pageTitle?: string;
  pageIntentHint?: string;
};

export type BuildChatPromptInput = {
  message: string;
  entrypoint?:
    | "home"
    | "agency"
    | "case"
    | "team"
    | "services"
    | "careers"
    | "news"
    | "other";
  pageContext?: PageContext;
};

function clip(s: string, max = 500): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message, entrypoint, pageContext } = input;

  return `
CONTEXTE_PAGE
- pageType: ${pageContext?.pageType ?? "other"}
- pageSlug: ${pageContext?.pageSlug ? clip(pageContext.pageSlug, 80) : "—"}
- pageTitle: ${pageContext?.pageTitle ? clip(pageContext.pageTitle, 120) : "—"}
- pageIntentHint: ${pageContext?.pageIntentHint ? clip(pageContext.pageIntentHint, 160) : "—"}

ENTRYPOINT
- ${entrypoint ?? "other"}

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
