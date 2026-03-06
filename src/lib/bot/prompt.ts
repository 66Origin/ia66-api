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

HISTORIQUE (faits “projet” déjà donnés par l’utilisateur)
${formatHistory(conversation?.history)}

CONSIGNE
- Produire une réponse naturelle et utile, en appliquant SYSTEM_CONTEXT.
- S’appuyer sur les contenus RAG pour tout fait sur 66 Origin et pour citer un projet.
- Par défaut : 3–10 lignes, une idée forte, retours à la ligne.
- Si l’utilisateur demande explicitement “détaille / explique / approfondis” : autoriser plus long.
- Si besoin d’un projet : 1 seul maximum + lien /works/<slug>.
- Ne jamais utiliser la première personne du singulier (“je”, “moi”, “mon” interdits).

MESSAGE UTILISATEUR
${clip(message, 2000)}

SORTIE
Texte brut uniquement.
`.trim();
}
