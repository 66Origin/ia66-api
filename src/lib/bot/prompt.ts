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

type Conversation = {
  history?: Array<{ role: "user" | "assistant"; text: string }>;
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
  conversation?: Conversation;
};

function clip(s: string, max = 500): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message, entrypoint, pageContext, conversation } = input;

  return `
CONTEXTE_PAGE
- pageType: ${pageContext?.pageType ?? "other"}
- pageSlug: ${pageContext?.pageSlug ? clip(pageContext.pageSlug, 80) : "—"}
- pageTitle: ${pageContext?.pageTitle ? clip(pageContext.pageTitle, 120) : "—"}
- pageIntentHint: ${pageContext?.pageIntentHint ? clip(pageContext.pageIntentHint, 160) : "—"}

ENTRYPOINT
- ${entrypoint ?? "other"}

RÈGLES LOCALES
- Utiliser le contenu RAG pour toute information factuelle liée à 66 Origin.
- Réponse longue uniquement si demandé.

PRIORITÉ FACTUELLE
- Pour toute question sur les projets, clients, cas ou réalisations de 66 Origin : vérifier d’abord via le contenu RAG avant de répondre.
- Si plusieurs projets semblent proches : choisir celui explicitement pertinent.
- Ne pas extrapoler à partir de projets similaires.
- Si plusieurs projets sont cités, traiter d’abord chacun brièvement avant de relier.

MESSAGE UTILISATEUR
${clip(message, 1200)}

SORTIE
Texte brut uniquement.
`.trim();
}
