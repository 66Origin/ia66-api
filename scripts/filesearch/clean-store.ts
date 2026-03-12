// scripts/filesearch/clean-store.ts
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

type StoreDoc = {
  name: string;
  displayName: string;
  createTime: string;
};

async function listAllDocs(storeName: string): Promise<StoreDoc[]> {
  const docs: StoreDoc[] = [];

  const pager = await ai.fileSearchStores.documents.list({
    parent: normalizeStoreName(storeName),
    config: {
      pageSize: 20,
    },
  });

  while (true) {
    for (const doc of pager.page) {
      if (doc?.name && doc?.displayName && doc?.createTime) {
        docs.push({
          name: doc.name,
          displayName: doc.displayName,
          createTime: doc.createTime,
        });
      }
    }

    if (!pager.hasNextPage()) break;
    await pager.nextPage();
  }

  return docs;
}

async function main() {
  const storeName = normalizeStoreName(requireEnv("FILE_SEARCH_STORE_NAME"));
  const docs = await listAllDocs(storeName);

  const grouped = new Map<string, StoreDoc[]>();

  for (const doc of docs) {
    if (!grouped.has(doc.displayName)) grouped.set(doc.displayName, []);
    grouped.get(doc.displayName)!.push(doc);
  }

  let deleted = 0;

  for (const [displayName, versions] of grouped.entries()) {
    if (versions.length <= 1) continue;

    versions.sort(
      (a, b) =>
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime(),
    );

    const remove = versions.slice(1);

    console.log(`Keeping latest: ${displayName}`);

    for (const doc of remove) {
      console.log(`Deleting old: ${doc.name}`);

      await ai.fileSearchStores.documents.delete({
        name: doc.name,
        config: {
          force: true,
        },
      });

      deleted++;
    }
  }

  console.log(`Done. deleted=${deleted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
