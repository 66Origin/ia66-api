import { config } from "dotenv";
import { classifyChatRequest } from "../../src/lib/analytics/classify-chat-request";
import type {
  ClassificationIntent,
  ClassificationResult,
  ClassificationSubject,
} from "../../src/lib/analytics/classification";
import type { ChatRequest } from "../../src/lib/schema";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

function classified(
  subject: ClassificationSubject,
  intent: ClassificationIntent,
): ClassificationResult {
  return { status: "classified", subject, intent };
}

type Scenario = {
  name: string;
  message: string;
  history?: ChatRequest["conversation"]["history"];
  expected: ClassificationResult;
};

const scenarios: Scenario[] = [
  {
    name: "Présentation",
    message: "Pouvez-vous me présenter votre agence ?",
    expected: classified("agency_team", "get_information"),
  },
  {
    name: "Expertise sans besoin commercial explicite",
    message: "Est-ce que vous faites du branding ?",
    expected: classified("expertise_services", "get_information"),
  },
  {
    name: "Recherche de références",
    message: "Montrez-moi des sites que vous avez réalisés.",
    expected: classified("projects_references", "explore_references"),
  },
  {
    name: "Besoin commercial explicite",
    message:
      "Mon entreprise cherche une agence pour créer son identité visuelle. " +
      "Pouvez-vous prendre en charge ce projet ?",
    expected: classified("expertise_services", "evaluate_agency"),
  },
  {
    name: "Candidature",
    message: "Comment vous transmettre ma candidature pour une alternance ?",
    expected: classified("careers", "apply"),
  },
  {
    name: "Contact",
    message: "Quelle adresse email utiliser pour joindre votre équipe ?",
    expected: classified("agency_team", "get_contact"),
  },
  {
    name: "Remerciement",
    message: "Merci beaucoup !",
    expected: {
      status: "unclassifiable",
      subject: null,
      intent: null,
    },
  },
  {
    name: "Hors périmètre",
    message: "Quelle est la capitale du Portugal ?",
    expected: classified("other", "other"),
  },
  {
    name: "Relance avec historique",
    message: "Et dans la santé ?",
    history: [
      {
        role: "user",
        text: "Avez-vous des références dans la finance ?",
      },
      {
        role: "assistant",
        text: "Nous pouvons vous présenter nos références dans ce secteur.",
      },
    ],
    expected: classified("projects_references", "explore_references"),
  },
];

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const rows = [];

  for (const scenario of scenarios) {
    const startedAt = performance.now();

    const actual = await classifyChatRequest({
      message: scenario.message,
      conversation: {
        history: scenario.history ?? [],
      },
    });

    const matches =
      actual.status === scenario.expected.status &&
      actual.subject === scenario.expected.subject &&
      actual.intent === scenario.expected.intent;

    rows.push({
      scenario: scenario.name,
      result: matches
        ? "OK"
        : actual.status === "failed"
          ? "TECHNICAL_FAILURE"
          : "MISMATCH",
      status: actual.status,
      subject: actual.subject,
      intent: actual.intent,
      expected_status: scenario.expected.status,
      expected_subject: scenario.expected.subject,
      expected_intent: scenario.expected.intent,
      duration_ms: Math.round(performance.now() - startedAt),
    });
  }

  console.table(rows);

  const passed = rows.filter((row) => row.result === "OK").length;

  console.log(`Classification model evaluation: ${passed}/${rows.length}`);

  if (passed !== rows.length) {
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error(
    "Classification model evaluation could not run. Check configuration.",
  );
  process.exitCode = 1;
});
