// scripts/filesearch/setup-file-search-store.ts
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Vérifie que la variable d’environnement existe.
 * Renvoie sa valeur.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

/**
 * Normalise le nom du store.
 */
function normalizeStoreName(store: string): string {
  return store.startsWith("fileSearchStores/")
    ? store
    : `fileSearchStores/${store}`;
}

/**
 * Liste les displayNames des documents existants dans le store.
 */
async function listExistingDisplayNames(
  storeName: string,
): Promise<Set<string>> {
  const existing = new Set<string>();
  const iterable = await ai.fileSearchStores.documents.list({
    parent: normalizeStoreName(storeName),
  });

  for await (const doc of iterable) {
    if (doc?.displayName) existing.add(doc.displayName);
  }
  return existing;
}

/**
 * Upload un fichier s’il n’existe pas déjà (displayName).
 */
async function uploadIfMissing(storeName: string, filePath: string) {
  const displayName = path.basename(filePath);

  const existing = await listExistingDisplayNames(storeName);
  if (existing.has(displayName)) {
    console.log(`Skip (already exists): ${displayName}`);
    return { skipped: true, displayName };
  }

  console.log(`Uploading: ${displayName} (${filePath})`);
  await ai.fileSearchStores.uploadToFileSearchStore({
    file: filePath,
    fileSearchStoreName: normalizeStoreName(storeName),
    config: { displayName },
  });
  console.log(`Uploaded: ${displayName}`);
  return { skipped: false, displayName };
}

async function main() {
  const storeName = normalizeStoreName(requireEnv("FILE_SEARCH_STORE_NAME"));

  // Dossier local des PDFs
  const docsDir = path.join(process.cwd(), "rag", "docs");
  if (!fs.existsSync(docsDir)) throw new Error(`Missing folder: ${docsDir}`);

  const pdfs = fs
    .readdirSync(docsDir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(docsDir, f));

  if (!pdfs.length) {
    console.log("No PDFs found in rag/docs/");
    return;
  }

  // Upload idempotent
  let uploaded = 0;
  let skipped = 0;

  for (const filePath of pdfs) {
    const res = await uploadIfMissing(storeName, filePath);
    if (res.skipped) skipped++;
    else uploaded++;
  }

  console.log(
    `Done. uploaded=${uploaded}, skipped=${skipped}, store=${storeName}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
