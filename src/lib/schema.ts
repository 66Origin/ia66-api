// src/lib/schema.ts
import { z } from "zod";

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
  conversation: chatConversationSchema,
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  text: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
