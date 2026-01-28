import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

async function main() {
  // Créer le dépôt File Search
  const store = await ai.fileSearchStores.create({
    config: { displayName: "66origin-case-studies-v1" },
  });

  console.log("STORE NAME =", store.name);

  // Importer directement un fichier existant dans le dépôt
  await ai.fileSearchStores.uploadToFileSearchStore({
    file: "rag/docs/case_001_quipo.pdf",
    fileSearchStoreName: store.name!,
    config: {
      displayName: "case_001_quipo.pdf",
    },
  });

  console.log("File successfully uploaded to the File Search store.");
}

main().catch(console.error);
