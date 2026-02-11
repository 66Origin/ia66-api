// src/lib/schema.ts
import { z } from "zod";

export const pageContextSchema = z
  .object({
    pageType: z
      .enum([
        "home",
        "project",
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
    pageIntentHint: z.string().trim().min(1).max(160).optional(),
  })
  .default({ pageType: "other" });

export const chatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
});

export const chatConversationSchema = z
  .object({
    turn: z.number().int().min(1).max(12).optional().default(1),
    maxTurns: z.number().int().min(1).max(12).optional().default(5),
    history: z.array(chatHistoryItemSchema).max(20).optional().default([]),

    // Flow "IA SITE 66"
    flowStep: z
      .union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
      ])
      .optional()
      .default(1),
    hasShownProject: z.boolean().optional().default(false),
    lastProjectSlug: z.string().trim().min(1).max(80).optional(),
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
  message: z.string().trim().min(1).max(2000),
  entrypoint: z
    .enum([
      "home",
      "project",
      "agency",
      "case",
      "team",
      "services",
      "works",
      "careers",
      "news",
      "other",
    ])
    .optional(),
  pageContext: pageContextSchema.optional(),

  conversation: chatConversationSchema.default({
    turn: 1,
    maxTurns: 5,
    history: [],
    flowStep: 1,
    hasShownProject: false,
  }),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  text: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
