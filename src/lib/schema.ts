import { z } from "zod";

export const outputSchema = z.object({
  miniBrief: z.object({
    resume: z.string(),
    contexte: z.string().optional().default(""),
    objectifs: z.array(z.string()).default([]),
    cibles: z.array(z.string()).default([]),
    livrables: z.array(z.string()).default([]),
    contraintes: z.array(z.string()).default([]),
    planning_estime: z.string().default(""),
  }),
  similarCases: z
    .array(
      z.object({
        id: z.string(),
        titre: z.string(),
        url: z.string().optional().default(""),
        pourquoi_c_est_pertinent: z.string().default(""),
        extraits: z.array(z.string()).default([]),
      })
    )
    .default([]),
  pitchAgence: z.string().default(""),
  questionsSuivantes: z.array(z.string()).default([]),
});

export type MiniBriefOutput = z.infer<typeof outputSchema>;

/** Input payload for POST /api/v1/chat */
export const chatInputSchema = z
  .object({
    description: z
      .string()
      .min(20, "Description too short (min 20 chars)")
      .max(2000, "Description too long (max 2000 chars)"),
    tags: z
      .array(z.string().trim().min(1).max(32))
      .max(4, "Too many tags (max 4)")
      .optional()
      .default([]),
  })
  .strict();

export type ChatInput = z.infer<typeof chatInputSchema>;
