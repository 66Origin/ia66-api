// app/api/v1/filesearch/stores/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { requireAdmin } from "@/lib/admin";
import { listFileSearchStores, deleteAllFileSearchStores } from "@/lib/gemini";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

// GET /api/v1/filesearch/stores
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const admin = requireAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status, headers }
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
      }
    );
  }

  try {
    const stores = await listFileSearchStores();

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
// Supprime tous les stores. Confirmation requise: ?confirm=true
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const admin = requireAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status, headers }
    );
  }

  const confirm = new URL(req.url).searchParams.get("confirm");
  if (confirm !== "true") {
    return NextResponse.json(
      { error: "Missing confirmation", hint: "Add ?confirm=true to proceed" },
      { status: 400, headers }
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
      }
    );
  }

  try {
    const result = await deleteAllFileSearchStores();

    return NextResponse.json(
      { message: "File search stores deleted", ...result },
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
