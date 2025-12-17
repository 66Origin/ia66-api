import { GoogleGenAI } from "@google/genai";

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey });
}

export function getFileSearchStoreName(): string {
  const name = process.env.FILE_SEARCH_STORE_NAME;
  if (!name) throw new Error("Missing FILE_SEARCH_STORE_NAME");
  return name;
}
