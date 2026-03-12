// app/api/v1/filesearch/stores/[store]/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { requireAdmin } from "@/lib/admin";
import {
  listFileSearchDocuments,
  deleteAllDocumentsFromStore,
} from "@/lib/gemini";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

// GET /api/v1/filesearch/stores/[store]/documents
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ store: string }> },
) {
  const { store } = await context.params;

  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const admin = requireAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status, headers },
    );
  }

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

  try {
    const documents = await listFileSearchDocuments(store);

    const normalizedStore = store.startsWith("fileSearchStores/")
      ? store
      : `fileSearchStores/${store}`;

    return NextResponse.json(
      { store: normalizedStore, documents },
      {
        status: 200,
        headers: {
          ...headers,
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetSeconds),
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to list documents", details: String(e), store },
      { status: 502, headers },
    );
  }
}

// DELETE /api/v1/filesearch/stores/[store]/documents
// Purge tous les documents du store. Confirmation requise: ?confirm=true
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ store: string }> },
) {
  const { store } = await context.params;

  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const admin = requireAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status, headers },
    );
  }

  const confirm = new URL(req.url).searchParams.get("confirm");
  if (confirm !== "true") {
    return NextResponse.json(
      { error: "Missing confirmation", hint: "Add ?confirm=true to proceed" },
      { status: 400, headers },
    );
  }

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

  try {
    const result = await deleteAllDocumentsFromStore(store);

    return NextResponse.json(
      {
        message: "All documents deleted",
        deleted: result.deleted,
        store: result.store,
      },
      {
        status: 200,
        headers: {
          ...headers,
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetSeconds),
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to delete documents", details: String(e), store },
      { status: 502, headers },
    );
  }
}
