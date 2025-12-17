import { NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/rateLimit";
import { getFileSearchStoreName, getGeminiClient } from "@/lib/gemini";
import { outputSchema } from "@/lib/schema";

export const runtime = "nodejs";
// Optionnel: si ton plan Vercel le permet
export const maxDuration = 60;

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

  try {
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
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rl.resetSeconds),
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

Règles de sortie:
- Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de texte autour).
- Respecte exactement la structure attendue.
- Si aucun cas pertinent n’est trouvé, renvoie "similarCases": [] sans inventer.
- Le miniBrief DOIT être rempli.

Structure attendue:
{
  "miniBrief": { "resume": "...", "contexte": "", "objectifs": [], "cibles": [], "livrables": [], "contraintes": [], "planning_estime": "" },
  "similarCases": [{ "id": "", "titre": "", "url": "", "pourquoi_c_est_pertinent": "", "extraits": [] }],
  "pitchAgence": "",
  "questionsSuivantes": []
}

Brief prospect:
${description}

Tags (si présents): ${tags.join(", ")}
`.trim();

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
          responseMimeType: "application/json",
          // ✅ PAS de responseJsonSchema ici (Zod v4 friendly)
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: "Gemini call failed", details: String(e) },
        { status: 502, headers }
      );
    }

    const rawText = response.text;
    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini response has no text output" },
        { status: 502, headers }
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch (e) {
      return NextResponse.json(
        {
          error: "Model did not return valid JSON",
          details: String(e),
          rawText,
        },
        { status: 502, headers }
      );
    }

    const validated = outputSchema.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Model output failed schema validation",
          issues: validated.error.issues,
          raw: json,
        },
        { status: 502, headers }
      );
    }

    const grounding = response.candidates?.[0]?.groundingMetadata;

    return NextResponse.json(
      { ...validated.data, grounding },
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
  } catch (e) {
    // Catch-all => plus jamais de 500 vide
    return NextResponse.json(
      { error: "Unhandled error", details: String(e) },
      { status: 500, headers }
    );
  }
}
