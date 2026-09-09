import "dotenv/config";
import path from "node:path";
import { generateSiteDocuments } from "../../src/lib/rag/site-generator";

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

async function main() {
  const outputDir = process.env.RAG_GENERATED_DIR
    ? path.resolve(process.env.RAG_GENERATED_DIR)
    : path.join(process.cwd(), "rag", "generated");

  const { report } = await generateSiteDocuments({
    baseUrl: process.env.RAG_SOURCE_URL,
    outputDir,
    requestDelayMs: positiveInteger(process.env.RAG_REQUEST_DELAY_MS, 100),
    concurrency: positiveInteger(process.env.RAG_CRAWL_CONCURRENCY, 4),
  });

  console.log("\nGénération RAG terminée");
  console.log(`- pages découvertes : ${report.discovered}`);
  console.log(`- fichiers créés    : ${report.created}`);
  console.log(`- fichiers modifiés : ${report.updated}`);
  console.log(`- fichiers inchangés: ${report.unchanged}`);
  console.log(`- pages manquantes  : ${report.missing}`);
  console.log(`- erreurs           : ${report.failed}`);
  console.log(`- sortie            : ${outputDir}`);

  if (report.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Échec de la génération RAG", error);
  process.exit(1);
});
