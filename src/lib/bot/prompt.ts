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
    .map((h) => {
      if (h.role === "user") return `UTILISATEUR (faits): ${h.text}`;
      return `ASSISTANT (proposition, non factuel): ${h.text}`;
    })
    .join("\n\n---\n\n");
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

USER_PROFILE_HINT (indicatif, peut être vide):
${userProfileHint ?? "—"}

CONVERSATION:
- turn: ${turn}
- maxTurns: ${maxTurns}
- history (peut contenir des infos déjà validées):
${formatHistory(conversation?.history)}

RÈGLE DE MÉMOIRE (OBLIGATOIRE)
- Considère toute info donnée dans l’historique comme acquise.
- N’en redemande aucune.
- Si une info manque, pose 1 question unique et ciblée.
- Sinon, propose une suite (2 options max) sans question.

ACQUIS_ATTENDUS (à produire dans la réponse)

ACQUIS (STRICT)
- Commence toujours par "ACQUIS:".
- ACQUIS doit contenir exactement 2 ou 3 puces (jamais 1, jamais 4+).
- Chaque puce doit fusionner les infos pour rester concis :
  - Regrouper budget + délai dans la même puce.
  - Regrouper “priorité” dans la même puce que le projet (pas une puce dédiée).
- ACQUIS est basé sur l’historique + le message (toute info de l’historique est acquise).
- Si l’historique contient type de projet / objectif / budget-délai, ACQUIS doit les reprendre explicitement (ne pas se limiter à “atelier confirmé”).

ORIENTATION / SUITE / QUESTION
- Puis "ORIENTATION:" (2–6 lignes) et "SUITE:" (1–2 options max).
- Finir éventuellement par "QUESTION:" avec UNE question unique (priorisation/diagnostic) uniquement si nécessaire.

IMPORTANT (FORMAT EXACT)
Utilise exactement ces en-têtes (majuscules + deux-points) et dans cet ordre :
ACQUIS:
ORIENTATION:
SUITE:
QUESTION: (uniquement si tu poses une question)

RÈGLE TURN LIMIT
Si turn >= maxTurns : ne pas inclure le bloc "QUESTION:".

CONTRAINTES OPÉRATIONNELLES
- Français.
- Aucune supposition non justifiée.
- 0 ou 1 question max (jamais plus).
- Si le projet est déjà qualifié, ne pose pas de question générale.
- Pour lecture_case : si tu ne retrouves pas explicitement le détail dans les documents, ne le mentionne pas.

RÈGLE NEWS_ARTICLE (STRICT)
Si pageType = "news_article" :
- Si le contenu de l’article n’est pas explicitement trouvé dans les documents (RAG), tu dois le dire clairement (limite docs) et NE PAS produire de “résumé”, même “à partir d’infos générales”.
- Interdiction de répondre avec une liste de X points si tu n’as pas le texte de l’article.
- Interdiction d’écrire des listes numérotées (1., 2., 3., …) dans ORIENTATION.
- Dans ce cas, SUITE doit proposer 1–2 alternatives maximum (ex: “coller le texte” / “donner le lien exact” / “résumer un autre contenu disponible”), sans inventer.


RÈGLE PRIORITAIRE (TURN LIMIT)
Si turn >= maxTurns :
- Tu produis un closing pragmatique SANS AUCUNE QUESTION (même A/B).
- Tu ne demandes aucune information supplémentaire.
- Tu proposes UNE action unique et concrète (ex: proposer un créneau / demander d’envoyer un brief par email / lien formulaire).
- Tu fais au mieux avec les infos disponibles ; si une info manque, tu le signales sans question.

TURN_LIMIT_OUTPUT (PRIORITÉ ABSOLUE)
Si turn >= maxTurns :
- Tu dois inclure AU MOINS 2 éléments factuels issus de l’historique dans "ACQUIS:" (si l’historique en contient).
- Tu termines impérativement après "SUITE:".
- Interdiction d’écrire le bloc "QUESTION:".
- Interdiction d’utiliser le caractère "?".
- "SUITE:" doit contenir UNE action unique concrète (ex: proposer d’envoyer 2 créneaux + participants + format via formulaire/contact).

RÈGLE QUESTION (STRICT)
- Le caractère "?" ne doit apparaître que dans le bloc "QUESTION:" (si présent).
- Dans ACQUIS/ORIENTATION/SUITE : aucune phrase interrogative, aucun "?".

MESSAGE_UTILISATEUR:
${message}

RAPPEL FINAL (PRIORITÉ ABSOLUE)
Si turn >= maxTurns :
- Interdiction d'écrire "QUESTION:".
- Interdiction d'utiliser le caractère "?".
- Termine après "SUITE:".

RAPPEL FINAL (TOUR LIMITE)
Si turn >= maxTurns : ACQUIS + ORIENTATION + SUITE uniquement. Pas de "QUESTION:" et pas de "?".

SORTIE:
Texte unique (pas de JSON). Style neutre et concis. Longueur indicative 70–160 mots (adapter à la nécessité).
`.trim();
}
