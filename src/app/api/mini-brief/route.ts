import { NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/rateLimit";
import { getGeminiClient, getFileSearchStoreName } from "@/lib/gemini";
import { outputSchema } from "@/lib/schema";

// Contexte minimal (règles non négociables)
const SYSTEM_CONTEXT = `
Tu es "IA 66", l’assistant commercial et stratégique de l'agence 66 Origin.
Ta mission :
1) Structurer le brief du prospect en mini-brief clair.
2) Proposer des projets similaires (issus du File Search) et expliquer pourquoi ils correspondent.
3) Expliquer ce que l’agence peut apporter.
4) Poser 3 à 6 questions de cadrage.

Règles strictes :
- Ne jamais inventer ou halluciner des informations.
- Toujours répondre en français.
- Respecter le format de réponse défini.
`.trim();

type Message = {
  role: "user" | "model";
  parts: { text: string }[];
};

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
  const history: Message[] = Array.isArray(body?.history) ? body.history : [];

  if (!description || typeof description !== "string") {
    return jsonError("Missing 'description' (string)", 400, origin);
  }
  if (description.length < 20)
    return jsonError("Description too short (min 20 chars)", 400, origin);
  if (description.length > 4000)
    return jsonError("Description too long (max 4000 chars)", 400, origin);

  const ai = getGeminiClient();
  const storeName = getFileSearchStoreName();

  console.log("Description:", description);
  console.log("Tags:", tags);
  console.log("History messages:", history.length);

  const contents: Message[] = [
    { role: "user", parts: [{ text: SYSTEM_CONTEXT }] },
    ...history,
    {
      role: "user",
      parts: [
        {
          text: `
          Brief prospect:
          ${description}

          Tags (si présents): ${tags.join(", ")}
          `.trim(),
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [storeName],
          },
        },
      ],
    },
  });

  function requireText(text: string | undefined): string {
    if (!text) throw new Error("Gemini response has no text output");
    return text;
  }

  const rawText = requireText(response.text);

  let parsed;
  try {
    parsed = outputSchema.parse(JSON.parse(rawText));
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid model output", details: String(e) },
      { status: 502, headers }
    );
  }

  return NextResponse.json(parsed, {
    status: 200,
    headers: {
      ...headers,
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(rl.resetSeconds),
    },
  });
}
