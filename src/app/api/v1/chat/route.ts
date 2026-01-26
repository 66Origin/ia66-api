// app/api/v1/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { getFileSearchStoreName, getGeminiClient } from "@/lib/gemini";
import { chatRequestSchema } from "@/lib/schema";
import { buildChatPrompt } from "@/lib/bot/prompt";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || "unknown";

  const rl = await rateLimitHourly(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { ...headers, "Retry-After": String(rl.resetSeconds) },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, origin);
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400, headers }
    );
  }

  const { message, entrypoint, pageContext } = parsed.data;

  const prompt =
    typeof buildChatPrompt === "function"
      ? buildChatPrompt({ message, entrypoint, pageContext })
      : `
Tu es "IA 66", assistant de 66 Origin.
Réponds en français. Ne jamais inventer.
Contexte page: ${JSON.stringify(pageContext ?? { pageType: "other" })}
Entrypoint: ${entrypoint ?? "other"}

Message utilisateur:
${message}
`.trim();

  const ai = getGeminiClient();
  const storeName = getFileSearchStoreName();

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Gemini call failed", details: String(e) },
      { status: 502, headers }
    );
  }

  const text = response.text;
  if (!text) {
    return NextResponse.json(
      { error: "Gemini response has no text output" },
      { status: 502, headers }
    );
  }

  return NextResponse.json(
    { text },
    {
      status: 200,
      headers: {
        ...headers,
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(rl.resetSeconds),
      },
    }
  );
}
