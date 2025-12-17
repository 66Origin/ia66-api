import { NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/rateLimit";
import { getGeminiClient, getFileSearchStoreName } from "@/lib/gemini";
import { outputSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

/* -------------------------------- utils -------------------------------- */

function trim(text: string, max = 2200) {
  const t = (text || "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 700
): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const msg = String(e);
    const retryable =
      msg.includes("503") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("overloaded");

    if (!retryable || retries <= 0) throw e;

    await new Promise((r) => setTimeout(r, delayMs));
    return withRetry(fn, retries - 1, delayMs * 1.6);
  }
}

function extractJsonFromText(text: string): string {
  // ```json ... ``` ou ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  // fallback : premier objet JSON
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

/* -------------------------------- handlers -------------------------------- */

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
    /* ------------------------------ rate limit ------------------------------ */
    const xff = req.headers.get("x-forwarded-for") || "";
    const ip = xff.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimitHourly(ip);

    const rateHeaders = {
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(rl.resetSeconds),
    };

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            ...headers,
            ...rateHeaders,
            "Retry-After": String(rl.resetSeconds),
          },
        }
      );
    }

    /* -------------------------------- input -------------------------------- */
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

    /* ============================ CALL 1 : FILE SEARCH ============================ */

    const searchPrompt = `
Tu es "IA 66".
Objectif : retrouver dans notre base de cas clients les passages pertinents.
- N’invente rien.
- Réponds en TEXTE court avec des extraits utiles.

Brief :
${description}

Tags :
${tags.join(", ")}
`.trim();

    let searchResp;
    try {
      searchResp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: searchPrompt,
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: "Gemini file search failed", details: String(e) },
        { status: 502, headers: { ...headers, ...rateHeaders } }
      );
    }

    const searchText = searchResp.text || "";
    const grounding = searchResp.candidates?.[0]?.groundingMetadata;

    /* ============================ CALL 2 : JSON STRICT ============================ */

    const jsonPrompt = `
Tu es "IA 66", l’assistant commercial et stratégique d’une agence de design.

RÈGLES IMPÉRATIVES :
- Réponds UNIQUEMENT avec l’objet JSON brut.
- INTERDIT d’utiliser du markdown ou des \`\`\`.
- Respecte EXACTEMENT la structure.
- Si aucun cas pertinent : "similarCases": [].
- Le miniBrief DOIT être rempli.

CONTEXTE (extraits de la base) :
${trim(searchText)}

BRIEF :
${description}

TAGS :
${tags.join(", ")}

FORMAT JSON :
{
  "miniBrief": {
    "resume": "string",
    "contexte": "string",
    "objectifs": ["string"],
    "cibles": ["string"],
    "livrables": ["string"],
    "contraintes": ["string"],
    "planning_estime": "string"
  },
  "similarCases": [
    {
      "id": "string",
      "titre": "string",
      "url": "string",
      "pourquoi_c_est_pertinent": "string",
      "extraits": ["string"]
    }
  ],
  "pitchAgence": "string",
  "questionsSuivantes": ["string"]
}
`.trim();

    let genResp;
    try {
      genResp = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: jsonPrompt,
        })
      );
    } catch {
      genResp = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: jsonPrompt,
        })
      );
    }

    const rawText = genResp.text;
    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini JSON response empty" },
        { status: 502, headers: { ...headers, ...rateHeaders } }
      );
    }

    /* --------------------------- parse + validate --------------------------- */
    let json: unknown;
    try {
      const jsonText = extractJsonFromText(rawText);
      json = JSON.parse(jsonText);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON from model", details: String(e), rawText },
        { status: 502, headers: { ...headers, ...rateHeaders } }
      );
    }

    const validated = outputSchema.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Schema validation failed",
          issues: validated.error.issues,
          raw: json,
        },
        { status: 502, headers: { ...headers, ...rateHeaders } }
      );
    }

    /* -------------------------------- response -------------------------------- */

    return NextResponse.json(
      { ...validated.data, grounding },
      { status: 200, headers: { ...headers, ...rateHeaders } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Unhandled error", details: String(e) },
      { status: 500, headers }
    );
  }
}
