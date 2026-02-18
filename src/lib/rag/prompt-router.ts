import { getRagIndex } from "./index";

type PageContext = {
  pageType?: string;
  pageSlug?: string;
  pageTitle?: string;
  pageIntentHint?: string;
};

export type BuildRagRoutingHintInput = {
  message: string;
  pageContext?: PageContext;
};

function normalizeText(s: string): string {
  return (s ?? "").toLowerCase();
}

function scoreKeywords(haystack: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (haystack.includes(kw.toLowerCase())) score++;
  }
  return score;
}

function inferIntent(query: string): string | null {
  const idx = getRagIndex();
  const routes = idx.intent_routes ?? [];
  if (!routes.length) return null;

  const q = normalizeText(query);
  let bestIntent: string | null = null;
  let bestScore = 0;

  for (const r of routes) {
    const s = scoreKeywords(q, r.keywords ?? []);
    if (s > bestScore) {
      bestScore = s;
      bestIntent = r.intent;
    }
  }

  return bestScore > 0 ? bestIntent : null;
}

function collectBoostDocIds(query: string): Set<string> {
  const idx = getRagIndex();
  const out = new Set<string>();
  const q = normalizeText(query);

  const intent = inferIntent(query);
  if (intent && idx.intent_routes?.length) {
    const route = idx.intent_routes.find((r) => r.intent === intent);
    for (const id of route?.doc_ids ?? []) out.add(id);
  }

  const rules = idx.corpus?.retrieval_hints?.boost_rules ?? [];
  for (const rule of rules) {
    const hit = (rule.if_query_contains ?? []).some((t) =>
      q.includes(t.toLowerCase()),
    );
    if (!hit) continue;
    for (const id of rule.boost_docs ?? []) out.add(id);
  }

  return out;
}

function docIdToDisplayName(docId: string): string | null {
  const idx = getRagIndex();
  const doc = idx.documents?.find((d) => d.doc_id === docId);
  if (!doc) return null;
  return doc.displayName ?? null;
}

/**
 * Section optionnelle à préfixer au prompt.
 * Objectif : guider Gemini dans sa recherche File Search (routing "soft").
 */
export function buildRagRoutingHint(input: BuildRagRoutingHintInput): string {
  const q = [input.message, input.pageContext?.pageIntentHint]
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!q) return "";

  const intent = inferIntent(q);
  const boosted = [...collectBoostDocIds(q)];
  const displayNames = boosted
    .map(docIdToDisplayName)
    .filter((x): x is string => Boolean(x));

  if (!intent && !displayNames.length) return "";

  const lines: string[] = [];
  lines.push("RAG_ROUTING (INTERNE)");
  if (intent) lines.push(`- intent: ${intent}`);
  if (displayNames.length) {
    lines.push("- sources_prioritaires:");
    for (const dn of displayNames.slice(0, 6)) lines.push(`  - ${dn}`);
  }
  lines.push(
    "RÈGLE: prioriser ces sources si elles sont pertinentes; sinon utiliser le reste du corpus.",
  );

  return lines.join("\n");
}
