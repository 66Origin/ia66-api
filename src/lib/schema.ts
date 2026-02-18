// src/lib/schema.ts
import { z } from "zod";

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
    pageIntentHint: z.string().trim().min(1).max(160).optional(),
  })
  .default({ pageType: "other" });

export const chatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
});

export const chatConversationSchema = z
  .object({
    history: z.array(chatHistoryItemSchema).max(20).optional().default([]),
  })
  .optional()
  .default({ history: [] });

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  entrypoint: z
    .enum(["home", "services", "project", "agency", "careers", "news", "other"])
    .optional(),
  pageContext: pageContextSchema.optional(),
  conversation: chatConversationSchema,
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  text: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
