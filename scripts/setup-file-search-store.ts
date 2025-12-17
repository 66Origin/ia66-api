import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  // 1) Create store
  const store = await ai.fileSearchStores.create({
    config: { displayName: "66origin-case-studies-v1" },
  });

  const storeName = store.name;
  if (!storeName) {
    throw new Error("FileSearchStore created but store.name is undefined");
  }

  console.log("✅ File Search Store created:");
  console.log("STORE NAME =", storeName);

  // 2) Upload files from rag/docs
  const docsDir = path.join(process.cwd(), "rag", "docs");
  const files = fs.readdirSync(docsDir).filter((f) => !f.startsWith("."));

  if (files.length === 0) {
    console.log("⚠️ No files found in rag/docs");
    return;
  }

  for (const fileName of files) {
    const filePath = path.join(docsDir, fileName);

    console.log(`\n⬆️ Uploading ${fileName}...`);

    let op = await ai.fileSearchStores.uploadToFileSearchStore({
      file: filePath,
      fileSearchStoreName: storeName,
      config: {
        // visible dans les citations
        displayName: fileName,
        // chunking optionnel (V1 ok par défaut)
        // chunkingConfig: { whiteSpaceConfig: { maxTokensPerChunk: 200, maxOverlapTokens: 20 } }
      },
    });

    while (!op.done) {
      await sleep(5000);
      op = await ai.operations.get({ operation: op });
      process.stdout.write(".");
    }
    console.log("\n✅ Done:", fileName);
  }

  console.log("\n🎉 All files uploaded.");
  console.log("➡️ Copie ce STORE NAME dans Vercel: FILE_SEARCH_STORE_NAME");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
