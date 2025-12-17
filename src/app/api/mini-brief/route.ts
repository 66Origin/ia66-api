import { NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/rateLimit";
import { getFileSearchStoreName, getGeminiClient } from "@/lib/gemini";
import { outputSchema } from "@/lib/schema";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const jsonSchema = zodToJsonSchema(outputSchema as z.ZodTypeAny);

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers });
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
        headers: {
          ...headers,
          "Retry-After": String(rl.resetSeconds),
        },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const description = body?.description;
  const tags: string[] = Array.isArray(body?.tags) ? body.tags : [];

  if (!description || typeof description !== "string") {
    return jsonError("Missing 'description' (string)", 400, origin);
  }
  if (description.length < 20) {
    return jsonError("Description too short (min 20 chars)", 400, origin);
  }
  if (description.length > 4000) {
    return jsonError("Description too long (max 4000 chars)", 400, origin);
  }

  const ai = getGeminiClient();
  const storeName = getFileSearchStoreName();

  const prompt = `
Tu es "IA 66", l’assistant commercial et stratégique d’une agence de design.
Ta mission :
1) Structurer le brief du prospect en mini-brief clair.
2) Proposer des projets similaires (issus du File Search) et expliquer pourquoi ils matchent.
3) Expliquer ce que l’agence peut apporter.
4) Poser 3 à 6 questions de cadrage.

Brief prospect:
${description}

Tags (si présents): ${tags.join(", ")}
`.trim();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
    },
  });

  const rawText = response.text;
  if (!rawText) {
    return NextResponse.json(
      { error: "Gemini response has no text output" },
      { status: 502, headers }
    );
  }

  let parsed;
  try {
    parsed = outputSchema.parse(JSON.parse(rawText));
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid model output", details: String(e) },
      { status: 502, headers }
    );
  }

  const grounding = response.candidates?.[0]?.groundingMetadata;

  return NextResponse.json(
    { ...parsed, grounding },
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
