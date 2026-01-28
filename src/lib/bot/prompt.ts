// src/lib/prompt.ts
import { SYSTEM_CONTEXT } from "./system";

/**
 * (Legacy) v1 — mini brief / tags.
 */
export type BuildBotPromptInput = {
  description: string;
  tags: string[];
};

export function buildBotPrompt(input: BuildBotPromptInput): string {
  const { description, tags } = input;

  return `
${SYSTEM_CONTEXT}

BRIEF:
${description}

TAGS:
${tags.length ? tags.join(", ") : "—"}

TÂCHE:
1) Structurer le brief en mini-brief clair.
2) Citer 1–3 projets similaires pertinents (si disponibles) et expliquer pourquoi ça matche.
3) Dire ce que 66 Origin peut apporter.
4) Poser 1–3 questions de cadrage utiles (si nécessaire).
`.trim();
}

/**
 * v2 — chat contextualisé (page + profil + tours).
 * Prévu pour évoluer vers multi-turn (history).
 */
export type ChatUserProfileHint =
  | "prospect_project"
  | "prospect_info"
  | "curious"
  | "candidate"
  | "partner"
  | "press"
  | "other";

export type ChatHistoryItem = {
  role: "user" | "assistant";
  text: string;
};

export type BuildChatPromptInput = {
  message: string;

  entrypoint?:
    | "project"
    | "agency"
    | "case"
    | "team"
    | "services"
    | "careers"
    | "news"
    | "other";

  userProfileHint?: ChatUserProfileHint;

  conversation?: {
    turn?: number; // 1-based (1,2,3...)
    maxTurns?: number; // ex: 5
    history?: ChatHistoryItem[];
  };

  pageContext?: {
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
    pageIntentHint?: string; // 1 phrase max
  };
};

function formatHistory(history?: ChatHistoryItem[]) {
  if (!history?.length) return "—";
  return history
    .slice(-10)
    .map((h) => `${h.role.toUpperCase()}: ${h.text}`)
    .join("\n\n");
}

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message, entrypoint, pageContext, conversation, userProfileHint } =
    input;

  const turn = conversation?.turn ?? 1;
  const maxTurns = conversation?.maxTurns ?? 5;

  return `
${SYSTEM_CONTEXT}

CONTEXTE_PAGE:
- pageType: ${pageContext?.pageType ?? "other"}
- pageSlug: ${pageContext?.pageSlug ?? "—"}
- pageTitle: ${pageContext?.pageTitle ?? "—"}
- pageIntentHint: ${pageContext?.pageIntentHint ?? "—"}

ENTRYPOINT:
${entrypoint ?? "other"}

USER_PROFILE_HINT:
${userProfileHint ?? "—"}

CONVERSATION:
- turn: ${turn}
- maxTurns: ${maxTurns}
- history:
${formatHistory(conversation?.history)}

TÂCHE:
Tu réponds au message de l’utilisateur ci-dessous.
Contraintes :
- Réponds en français.
- Ne fais aucune supposition non justifiée.
- Ne repose jamais une question déjà répondue.
- 1 question maximum, uniquement si nécessaire.
- Si le projet est déjà qualifié (refonte/branding/site/leads/budget/délai), ne demande jamais “quel type de projet”.
- Si tu poses une question : elle doit être un arbitrage/priorisation (deux options explicites) OU un diagnostic ciblé.
- Si turn >= maxTurns : tu dois conclure (synthèse + proposition claire + action unique) et ne poser aucune question.

MESSAGE_UTILISATEUR:
${message}

SORTIE:
Texte unique (pas de JSON), 100 à 200 mots, ton conversationnel, concret.
`.trim();
}
