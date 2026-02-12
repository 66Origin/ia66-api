// scripts/filesearch/setup-store.ts
import "dotenv/config";
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
 * Vérifie si un store existe déjà.
 */
async function storeExists(storeName: string): Promise<boolean> {
  const iterable = await ai.fileSearchStores.list();
  for await (const store of iterable) {
    if (store?.name === normalizeStoreName(storeName)) {
      return true;
    }
  }
  return false;
}

async function main() {
  const rawName = requireEnv("FILE_SEARCH_STORE_NAME");
  const storeName = normalizeStoreName(rawName);

  const exists = await storeExists(storeName);

  if (exists) {
    console.log(`Store already exists: ${storeName}`);
    return;
  }

  console.log(`Creating store: ${storeName}`);

  const created = await ai.fileSearchStores.create({
    config: {
      displayName: rawName,
    },
  });

  console.log(`Store created: ${created.name}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
