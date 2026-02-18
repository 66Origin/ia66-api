import fs from "node:fs";
import path from "node:path";

export type RagIndex = {
  corpus?: {
    retrieval_hints?: {
      boost_rules?: Array<{
        if_query_contains: string[];
        boost_docs: string[];
      }>;
    };
  };
  documents?: Array<{
    doc_id: string;
    file: string;
    displayName?: string;
    title?: string;
    summary?: string;
    keywords?: string[];
  }>;
  intent_routes?: Array<{
    intent: string;
    keywords: string[];
    doc_ids: string[];
    description?: string;
  }>;
};

let cached: RagIndex | null = null;

export function getRagIndex(): RagIndex {
  if (cached) return cached;

  const indexPath = path.join(
    process.cwd(),
    "rag",
    "index",
    "rag_index_66origin.json",
  );

  const raw = fs.readFileSync(indexPath, "utf-8");
  cached = JSON.parse(raw) as RagIndex;
  return cached;
}
