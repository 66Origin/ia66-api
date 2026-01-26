// src/lib/schema.ts
import { z } from "zod";

/**
 * Contexte de la page où l’utilisateur se trouve.
 */
export const pageContextSchema = z
  .object({
    pageType: z
      .enum(["home", "case", "team", "services", "careers", "contact", "other"])
      .default("other"),
    pageSlug: z.string().trim().min(1).max(80).optional(),
    pageTitle: z.string().trim().min(1).max(120).optional(),
    /**
     *
     * Indice sur l'intention de l’utilisateur sur cette page.
     * Indice très court: 1 phrase max.
     * Ex: "L’utilisateur consulte la page Quipo."
     */
    pageIntentHint: z.string().trim().min(1).max(160).optional(),
  })
  .default({ pageType: "other" });

export const chatRequestSchema = z.object({
  message: z.string().trim().min(20).max(2000),
  entrypoint: z
    .enum(["project", "agency", "case", "team", "services", "careers", "other"])
    .optional(),
  pageContext: pageContextSchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Réponse du chatbot.
 */
export const chatResponseSchema = z.object({
  text: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
