// scripts/filesearch/upload-docs.ts
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalizeStoreName(store: string): string {
  return store.startsWith("fileSearchStores/")
    ? store
    : `fileSearchStores/${store}`;
}

/**
 * Récupère les displayNames existants UNE FOIS (idempotence).
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
 * Liste récursivement les fichiers d'un dossier.
 */
function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

/**
 * Construit un displayName stable (inclut le chemin relatif pour éviter collisions).
 * Exemple: contenus/01_identite.md
 */
function buildDisplayName(docsDir: string, filePath: string): string {
  const rel = path.relative(docsDir, filePath).replaceAll("\\", "/");
  return rel;
}

async function uploadIfMissing(
  storeName: string,
  docsDir: string,
  filePath: string,
  existing: Set<string>,
) {
  const displayName = buildDisplayName(docsDir, filePath);

  if (existing.has(displayName)) {
    console.log(`Skip (already exists): ${displayName}`);
    return { skipped: true, displayName };
  }

  console.log(`Uploading: ${displayName} (${filePath})`);
  await ai.fileSearchStores.uploadToFileSearchStore({
    file: filePath,
    fileSearchStoreName: normalizeStoreName(storeName),
    config: {
      displayName,
      mimeType: "text/markdown",
    },
  });

  existing.add(displayName);
  console.log(`Uploaded: ${displayName}`);
  return { skipped: false, displayName };
}

async function main() {
  const storeName = normalizeStoreName(requireEnv("FILE_SEARCH_STORE_NAME"));

  // Dossier local des docs RAG
  const docsDir = path.join(process.cwd(), "rag", "docs");
  if (!fs.existsSync(docsDir)) throw new Error(`Missing folder: ${docsDir}`);

  // Récupère tous les fichiers .md (récursif)
  const files = listFilesRecursive(docsDir).filter((f) =>
    f.toLowerCase().endsWith(".md"),
  );

  if (!files.length) {
    console.log("No .md files found in rag/docs/");
    return;
  }

  // Idempotence: lire l'existant UNE fois
  const existing = await listExistingDisplayNames(storeName);

  let uploaded = 0;
  let skipped = 0;

  for (const filePath of files) {
    const res = await uploadIfMissing(storeName, docsDir, filePath, existing);
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
