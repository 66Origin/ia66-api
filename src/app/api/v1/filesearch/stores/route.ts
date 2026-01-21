// app/api/v1/filesearch/stores/route.ts
import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/rateLimit";
import { getGeminiClient } from "@/lib/gemini";
import { requireAdmin } from "@/lib/admin";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

// GET /api/v1/filesearch/stores
export async function GET(req: Request) {
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

// DELETE /api/v1/filesearch/stores
export async function DELETE(req: Request) {
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

  try {
    const ai = getGeminiClient();

    const stores: Array<{ name?: string }> = [];
    const iterable = await ai.fileSearchStores.list();
    for await (const store of iterable) {
      if (store?.name) stores.push({ name: store.name });
    }

    for (const store of stores) {
      await ai.fileSearchStores.delete({
        name: store.name!,
        config: { force: true },
      });
    }

    return NextResponse.json(
      { message: "File search stores deleted", count: stores.length },
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
