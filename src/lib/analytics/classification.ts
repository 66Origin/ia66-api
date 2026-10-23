import { z } from "zod";

export const CLASSIFICATION_VERSION = "v1" as const;

export const CLASSIFICATION_SUBJECTS = [
  "agency_team",
  "expertise_services",
  "projects_references",
  "method_collaboration",
  "careers",
  "news_content",
  "other",
] as const;

export const CLASSIFICATION_INTENTS = [
  "get_information",
  "explore_references",
  "evaluate_agency",
  "get_contact",
  "apply",
  "propose_partnership",
  "other",
] as const;

export const classificationSubjectSchema = z.enum(CLASSIFICATION_SUBJECTS);

export const classificationIntentSchema = z.enum(CLASSIFICATION_INTENTS);

const classifiedSchema = z.strictObject({
  status: z.literal("classified"),
  subject: classificationSubjectSchema,
  intent: classificationIntentSchema,
});

const unclassifiableSchema = z.strictObject({
  status: z.literal("unclassifiable"),
  subject: z.null(),
  intent: z.null(),
});

// Only these two outcomes may be returned by the classifier.
export const classificationResultSchema = z.discriminatedUnion("status", [
  classifiedSchema,
  unclassifiableSchema,
]);

// A technical failure is produced by the server, never by the model.
const failedSchema = z.strictObject({
  status: z.literal("failed"),
  subject: z.null(),
  intent: z.null(),
});

export const classificationOutcomeSchema = z.discriminatedUnion("status", [
  classifiedSchema,
  unclassifiableSchema,
  failedSchema,
]);

export type ClassificationSubject = z.infer<typeof classificationSubjectSchema>;

export type ClassificationIntent = z.infer<typeof classificationIntentSchema>;

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

export type ClassificationOutcome = z.infer<typeof classificationOutcomeSchema>;
