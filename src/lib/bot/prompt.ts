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
  turn?: number;
  maxTurns?: number;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
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
  pageContext?: PageContext;
  conversation?: Conversation;
  userProfileHint?:
    | "prospect_project"
    | "prospect_info"
    | "curious"
    | "candidate"
    | "partner"
    | "press"
    | "other";
};

function clip(s: string, max = 280): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function formatHistory(
  history?: Array<{ role: "user" | "assistant"; text: string }>,
) {
  if (!history?.length) return "- (vide)";
  return history
    .slice(-5)
    .map((h) => `- ${h.role}: ${clip(h.text, 280)}`)
    .join("\n");
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
- pageSlug: ${pageContext?.pageSlug ? clip(pageContext.pageSlug, 80) : "—"}
- pageTitle: ${pageContext?.pageTitle ? clip(pageContext.pageTitle, 120) : "—"}
- pageIntentHint: ${
    pageContext?.pageIntentHint ? clip(pageContext.pageIntentHint, 160) : "—"
  }

ENTRYPOINT:
${entrypoint ?? "other"}

USER_PROFILE_HINT (indicatif):
${userProfileHint ?? "—"}

CONVERSATION:
- turn: ${turn}
- maxTurns: ${maxTurns}
- history:
${formatHistory(conversation?.history)}

RÈGLES PRIORITAIRES (OBLIGATOIRES)
- Toute info présente dans l’historique est acquise : ne la redemande jamais.
- Fais progresser la conversation à chaque réponse.
- 0 ou 1 question maximum.
- Si turn >= maxTurns :
  - Interdiction d’écrire "QUESTION:"
  - Interdiction d’utiliser le caractère "?"
  - Termine après "SUITE:" (une action unique et concrète)

FORMAT STRICT DE SORTIE (OBLIGATOIRE)
- Réponds UNIQUEMENT avec ces sections, dans cet ordre exact :
ACQUIS:
ORIENTATION:
SUITE:
QUESTION: (uniquement si nécessaire)
- Aucun texte avant "ACQUIS:".
- Aucun texte après le dernier bloc.
- Pas de salutation ("Bonjour", "Hello", etc.).
- Le caractère "?" ne doit apparaître que dans le bloc "QUESTION:" (si présent).
- Dans ACQUIS / ORIENTATION / SUITE : aucune phrase interrogative, aucun "?".

CONTENU ATTENDU PAR SECTION
ACQUIS:
- 1 à 3 puces max.
- Basé sur l’historique + le message.
- Si des éléments de cadrage sont connus (objectif, cible, budget, délai, périmètre), les reprendre ici.

ORIENTATION:
- 2 à 6 lignes.
- Adapter l’angle à ENTRYPOINT + CONTEXTE_PAGE + USER_PROFILE_HINT.
- Ne fais aucune supposition non justifiée.
- Si une info manque et qu’elle est nécessaire, garde-la pour QUESTION (une seule).

SUITE:
- 1 à 2 options max, formulées comme des actions concrètes.
- Si turn >= maxTurns : UNE seule action unique.

QUESTION: (optionnel)
- Une seule question, ciblée (priorisation / diagnostic).
- Ne jamais demander "quel type de projet" si le projet est déjà qualifié dans l’historique.

CONTRAINTE DE SOURCES (PRIORITAIRE)
- Si tu affirmes un fait sur 66 Origin, Quipo ou un document, ce fait doit être présent dans les documents via File Search.
- Si l’information nécessaire n’est pas dans les documents (ou si le document attendu n’existe pas) :
  - ORIENTATION doit commencer par la phrase exacte :
    "Je ne le vois pas dans les documents actuels."
  - Ne jamais écrire cette phrase en dehors du bloc ORIENTATION.
  - ACQUIS / SUITE restent obligatoires.
- Si tu dois refuser / limiter à cause des documents, tu dois quand même commencer par "ACQUIS:" (jamais par une phrase isolée).

MESSAGE_UTILISATEUR:
${clip(message, 2000)}

SORTIE:
Texte unique (pas de JSON). Ne pas inclure de code.
`.trim();
}
