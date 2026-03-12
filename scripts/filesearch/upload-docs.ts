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

type ExistingDoc = {
  name: string;
  displayName: string;
};

async function listExistingDocs(
  storeName: string,
): Promise<Map<string, ExistingDoc>> {
  const docs = new Map<string, ExistingDoc>();

  const pager = await ai.fileSearchStores.documents.list({
    parent: normalizeStoreName(storeName),
    config: {
      pageSize: 20,
    },
  });

  while (true) {
    for (const doc of pager.page) {
      if (doc?.displayName && doc?.name && !docs.has(doc.displayName)) {
        docs.set(doc.displayName, {
          name: doc.name,
          displayName: doc.displayName,
        });
      }
    }

    if (!pager.hasNextPage()) break;
    await pager.nextPage();
  }

  return docs;
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }

  return out;
}

function buildDisplayName(docsDir: string, filePath: string): string {
  return path.relative(docsDir, filePath).replaceAll("\\", "/");
}

async function syncFile(
  storeName: string,
  docsDir: string,
  filePath: string,
  existingDocs: Map<string, ExistingDoc>,
): Promise<"new" | "skipped"> {
  const displayName = buildDisplayName(docsDir, filePath);

  if (existingDocs.has(displayName)) {
    console.log(`Skipping existing: ${displayName}`);
    return "skipped";
  }

  console.log(`Uploading new: ${displayName}`);

  await ai.fileSearchStores.uploadToFileSearchStore({
    file: filePath,
    fileSearchStoreName: normalizeStoreName(storeName),
    config: {
      displayName,
      mimeType: "text/markdown",
    },
  });

  console.log(`Uploaded: ${displayName}`);

  return "new";
}

async function main() {
  const storeName = normalizeStoreName(requireEnv("FILE_SEARCH_STORE_NAME"));
  const docsDir = path.join(process.cwd(), "rag", "docs");

  const files = listFilesRecursive(docsDir).filter((f) =>
    f.toLowerCase().endsWith(".md"),
  );

  const existingDocs = await listExistingDocs(storeName);

  let newCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const result = await syncFile(storeName, docsDir, filePath, existingDocs);
    if (result === "new") newCount++;
    else skippedCount++;
  }

  console.log(`Done. new=${newCount}, skipped=${skippedCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
