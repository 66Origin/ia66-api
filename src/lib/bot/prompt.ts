import { SYSTEM_CONTEXT } from "./system";

export type BuildBotPromptInput = {
  description: string;
  tags: string[];
};

export function buildBotPrompt(input: BuildBotPromptInput): string {
  const { description, tags } = input;

  return `
${SYSTEM_CONTEXT}

Brief prospect :
${description}

Tags (si présents) :
${tags.length ? tags.join(", ") : "—"}
`.trim();
}

export type BuildChatPromptInput = {
  message: string;
  entrypoint?:
    | "project"
    | "agency"
    | "case"
    | "team"
    | "services"
    | "careers"
    | "other";
  pageContext?: {
    pageType?: string;
    pageSlug?: string;
    pageTitle?: string;
    pageIntentHint?: string;
  };
};

export function buildChatPrompt(input: BuildChatPromptInput): string {
  const { message, entrypoint, pageContext } = input;

  return `
${SYSTEM_CONTEXT}

CONTEXT_PAGE:
- pageType: ${pageContext?.pageType ?? "other"}
- pageSlug: ${pageContext?.pageSlug ?? "—"}
- pageTitle: ${pageContext?.pageTitle ?? "—"}
- pageIntentHint: ${pageContext?.pageIntentHint ?? "—"}

ENTRYPOINT:
${entrypoint ?? "other"}

TASK:
Tu réponds au message de l’utilisateur ci-dessous.
- Réponds en français
- Ne fais aucune supposition non justifiée
- Si le message est flou, pose 1 question claire
- Adapte ton angle au contexte de page

USER_MESSAGE:
${message}

OUTPUT:
Réponse claire, concise, conversationnelle, 100 à 200 mots maximum.
`.trim();
}
