import { NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST() {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Dis juste bonjour.",
  });

  return NextResponse.json({
    text: response.text,
  });
}
