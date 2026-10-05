import fs from "node:fs";
import path from "node:path";

import type { RagSource } from "@/lib/gemini/rag";

type ManifestInsight = {
  type: "insight";
  slug: string;
  canonicalUrl: string;
  title?: string;
  description?: string;
  datePublished?: string;
  authorName?: string;
  category?: string;
  status: string;
};

type RagManifest = {
  documents: ManifestInsight[];
};

export function getLatestInsights(limit = 3): ManifestInsight[] {
  const manifestPath = path.join(
    process.cwd(),
    "rag",
    "generated",
    "manifest.json",
  );

  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as RagManifest;

  return manifest.documents
    .filter(
      (document) =>
        document.type === "insight" &&
        document.status === "active" &&
        document.datePublished,
    )
    .sort((a, b) => b.datePublished!.localeCompare(a.datePublished!))
    .slice(0, limit);
}

export function isInsightsFreshnessQuery(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const mentionsInsights =
    normalized.includes("insight") || normalized.includes("article");

  const asksFreshness =
    normalized.includes("dernier") ||
    normalized.includes("derniers") ||
    normalized.includes("derniere") ||
    normalized.includes("dernieres") ||
    normalized.includes("plus recent") ||
    normalized.includes("plus recente") ||
    normalized.includes("plus recents") ||
    normalized.includes("plus recentes");

  return mentionsInsights && asksFreshness;
}

export function buildLatestInsightsContext(limit = 3): string {
  const insights = getLatestInsights(limit);

  if (insights.length === 0) {
    return "";
  }

  return insights
    .map((insight, index) => {
      const lines = [
        `${index + 1}. ${insight.title ?? insight.slug}`,
        `date_published: ${insight.datePublished}`,
        `canonical_url: ${insight.canonicalUrl}`,
      ];

      if (insight.authorName) {
        lines.push(`author_name: ${insight.authorName}`);
      }

      if (insight.category) {
        lines.push(`category: ${insight.category}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

export function getLatestInsightSources(limit = 3): RagSource[] {
  return getLatestInsights(limit).map((insight) => ({
    url: insight.canonicalUrl,
    type: "insight",
    title: insight.title ?? insight.slug,
  }));
}

export function getLatestInsightsLimit(message: string): number {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const asksMultiple =
    normalized.includes("trois") ||
    normalized.includes("3 ") ||
    normalized.includes("derniers") ||
    normalized.includes("dernieres") ||
    normalized.includes("plus recents") ||
    normalized.includes("plus recentes");

  return asksMultiple ? 3 : 1;
}
