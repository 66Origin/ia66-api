import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400, origin);
  }

  const rawTags = body?.tags;

  if (rawTags !== undefined && !Array.isArray(rawTags)) {
    return jsonError(
      "Invalid 'tags' (must be an array of strings)",
      400,
      origin
    );
  }

  if (Array.isArray(rawTags) && rawTags.some((t) => typeof t !== "string")) {
    return jsonError(
      "Invalid 'tags' (must be an array of strings)",
      400,
      origin
    );
  }

  const tags = Array.isArray(rawTags) ? rawTags : [];

  return NextResponse.json(
    {
      ok: true,
      tags,
      tagsType: typeof rawTags,
    },
    { status: 200, headers }
  );
}
