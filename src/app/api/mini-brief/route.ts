import { NextResponse } from "next/server";
import { getGeminiClient, getFileSearchStoreName } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const description = body?.description;

  if (!description) {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  const ai = getGeminiClient();
  const storeName = getFileSearchStoreName();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Dis juste bonjour.",
  });

  return NextResponse.json({
    text: response.text,
  });
}
