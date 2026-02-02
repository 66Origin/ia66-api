// src/lib/schema.ts
import { z } from "zod";

/**
 * Contexte de la page où l’utilisateur se trouve.
 */
export const pageContextSchema = z
  .object({
    pageType: z
      .enum([
        "home",
        "services",
        "method",
        "works",
        "case",
        "team",
        "news",
        "news_article",
        "careers",
        "contact",
        "other",
      ])
      .default("other"),
    pageSlug: z.string().trim().min(1).max(80).optional(),
    pageTitle: z.string().trim().min(1).max(120).optional(),
    /**
     * Indice sur l'intention de l’utilisateur sur cette page (1 phrase max).
     * Ex: "L’utilisateur consulte la page Quipo."
     */
    pageIntentHint: z.string().trim().min(1).max(160).optional(),
  })
  .default({ pageType: "other" });

export const chatUserProfileHintSchema = z.enum([
  "prospect_project",
  "prospect_info",
  "curious",
  "candidate",
  "partner",
  "press",
  "other",
]);

export const chatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
});

export const chatConversationSchema = z
  .object({
    // optionnels pour permettre conversation: {} puis defaults
    turn: z.number().int().min(1).max(12).optional().default(1),
    maxTurns: z.number().int().min(1).max(12).optional().default(5),
    history: z.array(chatHistoryItemSchema).max(20).optional().default([]),
  })
  .superRefine((val, ctx) => {
    if (val.turn > val.maxTurns) {
      ctx.addIssue({
        code: "custom",
        path: ["turn"],
        message: "turn cannot be greater than maxTurns",
      });
    }
  });

export const chatRequestSchema = z.object({
  message: z.string().trim().min(10).max(2000),
  entrypoint: z
    .enum([
      "project",
      "agency",
      "case",
      "team",
      "services",
      "careers",
      "news",
      "other",
    ])
    .optional(),
  pageContext: pageContextSchema.optional(),
  userProfileHint: chatUserProfileHintSchema.optional(),
  // Toujours présent (avec defaults), même si l’input est {}
  conversation: chatConversationSchema.default({
    turn: 1,
    maxTurns: 5,
    history: [],
  }),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Réponse du chatbot.
 */
export const chatResponseSchema = z.object({
  text: z.string(),
  isFinal: z.boolean().optional(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
