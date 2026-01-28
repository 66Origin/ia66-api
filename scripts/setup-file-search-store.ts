// scripts/filesearch/setup-file-search-store.ts
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type UploadItem = {
  file: string;
  displayName: string;
};

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
 * Vérifie que le store de recherche de fichiers existe.
 * Renvoie le nom du store.
 */
async function ensureStore(): Promise<string> {
  const existing = process.env.FILE_SEARCH_STORE_NAME;
  if (existing?.trim()) return existing.trim();

  const store = await ai.fileSearchStores.create({
    config: { displayName: "66origin-case-studies-v1" },
  });

  if (!store.name) throw new Error("Store created but store.name is missing");

  console.log("STORE NAME =", store.name);
  console.log("Add this to .env.local:\nFILE_SEARCH_STORE_NAME=" + store.name);

  return store.name;
}

/**
 * Upload tous les fichiers au store de recherche de fichiers.
 */
async function uploadAll(storeName: string, items: UploadItem[]) {
  for (const item of items) {
    console.log(`Uploading: ${item.displayName} (${item.file})`);
    await ai.fileSearchStores.uploadToFileSearchStore({
      file: item.file,
      fileSearchStoreName: storeName,
      config: { displayName: item.displayName },
    });
  }
}

async function main() {
  requireEnv("GEMINI_API_KEY");

  //const storeName = await ensureStore();
  const storeName = "fileSearchStores/66origincasestudiesv1-w2gnqys4nkma";

  const docs: UploadItem[] = [
    {
      file: "rag/docs/66origin_playbook_global_v01_2026-01-26.pdf",
      displayName: "66origin_playbook_global_v01_2026-01-26.pdf",
    },
    {
      file: "rag/docs/66origin_faq_standard_v01_2026-01-26.pdf",
      displayName: "66origin_faq_standard_v01_2026-01-26.pdf",
    },
    {
      file: "rag/docs/66origin_case_quipo_v01_2026-01-26.pdf",
      displayName: "66origin_case_quipo_v01_2026-01-26.pdf",
    },
  ];

  await uploadAll(storeName, docs);

  console.log("Done. Files successfully uploaded to the File Search store.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
