import type {
  ClassificationIntent,
  ClassificationSubject,
} from "./classification";
import type { UnansweredReason } from "./record-unanswered-question";

export const SUBJECT_LABELS: Record<ClassificationSubject, string> = {
  agency_team: "Agence et équipe",
  expertise_services: "Expertises et services",
  projects_references: "Projets et références",
  method_collaboration: "Méthode et collaboration",
  careers: "Recrutement",
  news_content: "Actualités et contenus",
  other: "Autre",
};

export const INTENT_LABELS: Record<ClassificationIntent, string> = {
  get_information: "S'informer",
  explore_references: "Voir des réalisations",
  evaluate_agency: "Évaluer l'agence pour un besoin",
  get_contact: "Obtenir un contact",
  apply: "Candidater",
  propose_partnership: "Proposer un partenariat",
  other: "Autre",
};

export const PLACEMENT_LABELS = {
  home: "Accueil",
  global: "Global",
} as const;

export const REASON_LABELS: Record<UnansweredReason, string> = {
  generation_failed: "Échec de génération",
  empty_response: "Réponse vide",
  unclassifiable: "Non classable",
};

export function labelOf<T extends string>(
  labels: Record<T, string>,
  value: string | null,
): string {
  if (value === null) return "—";

  return (labels as Record<string, string>)[value] ?? value;
}
