import { NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/rateLimit";
import { getFileSearchStoreName, getGeminiClient } from "@/lib/gemini";

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
  if (description.length < 20)
    return jsonError("Description too short (min 20 chars)", 400, origin);
  if (description.length > 4000)
    return jsonError("Description too long (max 4000 chars)", 400, origin);

  const ai = getGeminiClient();
  const storeName = getFileSearchStoreName();

  const prompt = `
Tu es "IA 66", l’assistant commercial et stratégique d’une agence de design.
Ta mission :
1) Structurer le brief du prospect en mini-brief clair.
2) Proposer des projets similaires (issus du File Search) et expliquer pourquoi ils matchent.
3) Expliquer ce que l’agence peut apporter.
4) Poser 1 à 3 questions de cadrage.

Brief prospect:
${description}

Tags (si présents): ${tags.join(", ")}
`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
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

/*// Lister tous les File Search Stores
export async function GET(req: Request) {
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
      }
    );
  }

  try {
    const ai = getGeminiClient();

    const stores: Array<{
      name?: string;
      displayName?: string;
      createTime?: string;
    }> = [];

    const iterable = await ai.fileSearchStores.list();
    for await (const store of iterable) {
      stores.push({
        name: store?.name,
        displayName: store?.displayName,
        createTime: store?.createTime,
      });
    }

    return NextResponse.json(
      { stores },
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
    return NextResponse.json(
      { error: "Failed to list file search stores", details: String(e) },
      { status: 502, headers }
    );
  }
}

// Supprimer tous les File Search Stores
export async function DELETE_STORES(req: Request) {
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
      }
    );
  }

  try {
    const ai = getGeminiClient();

    const stores: Array<{
      name?: string;
      displayName?: string;
      createTime?: string;
    }> = [];

    const iterable = await ai.fileSearchStores.list();
    for await (const store of iterable) {
      stores.push({
        name: store?.name,
        displayName: store?.displayName,
        createTime: store?.createTime,
      });
    }

    for (const store of stores) {
      if (store.name) {
        await ai.fileSearchStores.delete({
          name: store.name,
          config: {
            force: true,
          },
        });
      }
    }
    return NextResponse.json(
      { message: `File search stores deleted` },
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
    return NextResponse.json(
      { error: "Failed to delete file search stores", details: String(e) },
      { status: 502, headers }
    );
  }
}

// Supprimer un document File Search Store par son nom
export async function DELETE_DOCUMENT(
  req: Request,
  { params }: { params: { name: string } }
) {
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
      }
    );
  }

  const documentName = params.name;
  if (!documentName) {
    return jsonError("Missing 'name' parameter", 400, origin);
  }

  const storeName = getFileSearchStoreName();
  const name = `fileSearchStores/${storeName}/documents/${documentName}`;

  try {
    const ai = getGeminiClient();

    await ai.fileSearchStores.documents.delete({
      name,
    });

    return NextResponse.json(
      { message: `Document ${documentName} deleted` },
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
    return NextResponse.json(
      { error: "Failed to delete document", details: String(e) },
      { status: 502, headers }
    );
  }
}*/
