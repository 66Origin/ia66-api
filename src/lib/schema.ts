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
