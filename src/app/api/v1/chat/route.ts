// src/app/api/v1/chat/route.ts
import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { getFileSearchStoreName } from "@/lib/gemini";
import { chatRequestSchema } from "@/lib/schema";
import { buildChatPrompt } from "@/lib/bot/prompt";
import { runRagChat } from "@/lib/gemini/rag";
import { extractEmailTemplate, removeEmailBlock } from "@/lib/parser/email";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const { headers } = corsHeaders(origin);

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse("Forbidden", { status: 403 });

  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || "unknown";

  const rl = await rateLimitHourly(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { ...headers, "Retry-After": String(rl.resetSeconds) },
      },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400, headers },
    );
  }

  const { message, entrypoint, pageContext, conversation } = parsed.data;

  const prompt = buildChatPrompt({
    message,
    entrypoint,
    pageContext,
  });
  const storeName = getFileSearchStoreName();

  try {
    const { text } = await runRagChat({
      model: "gemini-2.5-flash",
      prompt,
      history: conversation?.history,
      fileSearchStoreNames: [storeName],
    });

    if (!text.trim()) {
      return NextResponse.json(
        {
          text: "Il me manque un peu de contexte pour te répondre précisément - tu peux préciser ?",
        },
        { headers },
      );
    }

    // Parsing email
    const email = extractEmailTemplate(text);
    // Nettoyage du texte affiché
    const cleanText = removeEmailBlock(text);

    return NextResponse.json(
      {
        text: cleanText,
        email,
      },
      { headers },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Model error", details: String(e?.message ?? e) },
      { status: 500, headers },
    );
  }
}
