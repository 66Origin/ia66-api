// src/lib/prompt.ts
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
    | "services"
    | "project"
    | "agency"
    | "careers"
    | "news"
    | "other";
  pageContext?: PageContext;
  conversation?: Conversation;
};

function clip(s: string, max = 800): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function formatHistory(
  history?: Array<{ role: "user" | "assistant"; text: string }>,
) {
  if (!history?.length) return "- (vide)";
  return history
    .slice(-10)
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

HISTORIQUE (contexte de conversation)
${formatHistory(conversation?.history)}

TÂCHE
Répondre au message utilisateur.
Priorité des règles :
1) Si les documents RAG contiennent des règles de ton/comportement pour l’IA de 66 Origin (guidelines/personality), les appliquer en priorité.
2) Sinon, appliquer SYSTEM_CONTEXT.


MESSAGE UTILISATEUR
${clip(message, 2000)}

SORTIE
- Texte brut uniquement (pas de JSON, pas de code).
- Réponse courte par défaut. Détail uniquement si l’utilisateur le demande explicitement.
`.trim();
}
