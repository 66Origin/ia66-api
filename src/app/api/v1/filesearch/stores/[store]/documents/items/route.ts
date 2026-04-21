// DELETE /api/v1/filesearch/stores/[store]/documents/items
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { requireAdmin } from "@/lib/admin";
import { deleteFileSearchDocument } from "@/lib/gemini";

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

  const body = await req.json().catch(() => null);

  if (!body?.documents || !Array.isArray(body.documents)) {
    return NextResponse.json(
      { error: "Missing documents array" },
      { status: 400, headers },
    );
  }

  if (body.documents.length === 0) {
    return NextResponse.json(
      { error: "Empty documents array" },
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
    const results = await Promise.all(
      body.documents.map((doc: string) => deleteFileSearchDocument(store, doc)),
    );

    return NextResponse.json(
      {
        message: "Documents deleted",
        deleted: results.map((r) => r.deletedDocument),
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
      { error: "Failed to delete documents", details: String(e) },
      { status: 502, headers },
    );
  }
}
