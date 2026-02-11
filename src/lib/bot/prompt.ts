// src/lib/prompt.ts
import { SYSTEM_CONTEXT } from "./system";

type PageContext = {
  pageType?:
    | "home"
    | "project"
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
  /**
   * Pilote le flow HOME (1→5).
   * 1: positionnement
   * 2: preuve projet
   * 3: après projet
   * 4: approfondissement
   * 5: échange humain (si pertinent)
   */
  flowStep?: 1 | 2 | 3 | 4 | 5;
  hasShownProject?: boolean;
  lastProjectSlug?: string;
};

export type BuildChatPromptInput = {
  message: string;
  entrypoint?:
    | "home"
    | "project"
    | "agency"
    | "case"
    | "team"
    | "services"
    | "works"
    | "news"
    | "careers"
    | "other";
  pageContext?: PageContext;
  conversation?: Conversation;
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
    .slice(-6)
    .map((h) => `- ${h.role}: ${clip(h.text, 280)}`)
    .join("\n");
}

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message, entrypoint, pageContext, conversation } = input;

  const turn = conversation?.turn ?? 1;
  const maxTurns = conversation?.maxTurns ?? 5;

  // Par défaut, on considère le flow HOME.
  const flowStep = conversation?.flowStep ?? 1;
  const hasShownProject = conversation?.hasShownProject ?? false;
  const lastProjectSlug = conversation?.lastProjectSlug ?? "—";

  return `
${SYSTEM_CONTEXT}

CONTEXTE_PAGE
- pageType: ${pageContext?.pageType ?? "other"}
- pageSlug: ${pageContext?.pageSlug ? clip(pageContext.pageSlug, 80) : "—"}
- pageTitle: ${pageContext?.pageTitle ? clip(pageContext.pageTitle, 120) : "—"}
- pageIntentHint: ${pageContext?.pageIntentHint ? clip(pageContext.pageIntentHint, 160) : "—"}

ENTRYPOINT
- ${entrypoint ?? "other"}

CONVERSATION
- turn: ${turn}
- maxTurns: ${maxTurns}
- flowStep: ${flowStep}
- hasShownProject: ${hasShownProject ? "true" : "false"}
- lastProjectSlug: ${lastProjectSlug}
- history:
${formatHistory(conversation?.history)}

TÂCHE
Répondre à l’utilisateur en respectant strictement "IA SITE 66".

RÈGLES DE SORTIE (STRICT)
- 2 à 8 lignes maximum.
- Réponse structurée (retours à la ligne).
- Jamais à la première personne du singulier.
- Aucun superlatif, aucun marketing creux.
- Ne jamais promettre de ROI chiffré.
- Si une info nécessaire n’est pas dans les contenus disponibles : écrire exactement
  "Cette information n’est pas disponible dans les contenus actuels."
- Ne jamais inventer de projet. Un seul projet maximum si un projet est demandé/pertinent.
- Ne pas proposer de contact trop tôt : uniquement si l’utilisateur évoque son contexte
  ou demande un accompagnement concret, et idéalement après une preuve (projet).

GUIDE FLOW (HOME)
- Si flowStep=1 (ou conversation très initiale) et question générale :
  expliquer le positionnement de 66 Origin (sans projet, sans contact).
- Si l’utilisateur demande un exemple / cas concret / projet similaire / mentionne un thème :
  passer en "preuve" : proposer UN projet pertinent (4 à 8 lignes) + lien clair.
- Si un projet vient d’être présenté (hasShownProject=true) :
  ne pas enchaîner avec un autre projet ; proposer d’approfondir méthode ou contexte.
- Approfondissement : expliquer méthode/posture, neutre et concret.
- Échange humain : uniquement si pertinent (contexte utilisateur / demande explicite).

MESSAGE UTILISATEUR
${clip(message, 2000)}

SORTIE
Texte brut uniquement.
`.trim();
}
