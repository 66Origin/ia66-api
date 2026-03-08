// src/app/api/v1/chat/route.ts
import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { getGeminiClient, getFileSearchStoreName } from "@/lib/gemini";
import { chatRequestSchema } from "@/lib/schema";
import { buildChatPrompt } from "@/lib/bot/prompt";
import { runRagChat } from "@/lib/gemini/rag";

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
    conversation,
  });
  const storeName = getFileSearchStoreName();

  try {
    const { text } = await runRagChat({
      model: "gemini-2.5-flash",
      prompt,
      fileSearchStoreNames: [storeName],
    });
    if (!text.trim()) {
      return NextResponse.json(
        {
          text: [
            "Cette information n’est pas disponible dans les contenus actuels.",
            "On peut repartir d’un angle innovation : expérience, design, ou transformation.",
          ].join("\n"),
        },
        { headers },
      );
    }
    return NextResponse.json({ text }, { headers });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Model error", details: String(e?.message ?? e) },
      { status: 500, headers },
    );
  }
}
