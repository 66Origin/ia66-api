// src/lib/bot/prompt.ts
import { SYSTEM_CONTEXT } from "./system";

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

function formatHistory(
  history?: Array<{ role: "user" | "assistant"; text: string }>,
) {
  if (!history?.length) return "- (vide)";
  return history
    .slice(-8)
    .map((h) => `- ${h.role}: ${clip(h.text, 280)}`)
    .join("\n");
}

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message, entrypoint, pageContext, conversation } = input;

  return `
${SYSTEM_CONTEXT}

CONTEXTE_PAGE
- pageType: ${pageContext?.pageType ?? "other"}
- pageSlug: ${pageContext?.pageSlug ? clip(pageContext.pageSlug, 80) : "—"}
- pageTitle: ${pageContext?.pageTitle ? clip(pageContext.pageTitle, 120) : "—"}
- pageIntentHint: ${pageContext?.pageIntentHint ? clip(pageContext.pageIntentHint, 160) : "—"}

ENTRYPOINT
- ${entrypoint ?? "other"}

HISTORIQUE (faits déjà donnés par l’utilisateur)
${formatHistory(conversation?.history)}

RÈGLES D’APPLICATION
- Commencer directement par une réponse utile, sans détour inutile.
- Rester concret avant d’être stylistique.
- Utiliser le contenu RAG pour toute information factuelle liée à 66 Origin.
- Si l’information n’est pas présente dans le RAG : ne pas inventer ; projeter ou ouvrir une piste.
- Réponse courte par défaut.
- Réponse longue uniquement si l’utilisateur demande explicitement : "détaille", "explique", "approfondis".
- Toujours garder une ouverture conversationnelle.
- Si pertinent : proposer un axe d’innovation, une reformulation, ou un brief court.
- Jamais fermer brutalement l’échange.

MESSAGE UTILISATEUR
${clip(message, 2000)}

SORTIE
Texte brut uniquement.
`.trim();
}
