// app/api/v1/filesearch/stores/[store]/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { getGeminiClient } from "@/lib/gemini";
import { requireAdmin, normalizeStoreParent } from "@/lib/admin";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

// GET /api/v1/filesearch/stores/[store]/documents
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ store: string }> }
) {
  const { store } = await context.params;

  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const admin = requireAdmin(req);
  if (!admin.ok)
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status, headers }
    );

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

  const parent = normalizeStoreParent(store);

  try {
    const ai = getGeminiClient();
    const documents: Array<{
      name?: string;
      displayName?: string;
      createTime?: string;
    }> = [];

    const iterable = await ai.fileSearchStores.documents.list({ parent });
    for await (const doc of iterable) {
      documents.push({
        name: doc?.name,
        displayName: doc?.displayName,
        createTime: doc?.createTime,
      });
    }

    return NextResponse.json(
      { store: parent, documents },
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
      { error: "Failed to list documents", details: String(e), store: parent },
      { status: 502, headers }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ store: string }> }
) {
  const { store } = await context.params;
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const admin = requireAdmin(req);
  if (!admin.ok)
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status, headers }
    );

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
}
