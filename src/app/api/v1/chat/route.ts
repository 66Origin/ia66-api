// app/api/v1/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { runBot } from "@/lib/bot/run";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);
  if (!isAllowed) return new NextResponse(null, { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);

  return NextResponse.json(
    { debug: "chat-route-2026-01-23-1118" },
    { status: 418, headers }
  );

  /*if (!isAllowed)
    return new NextResponse("Forbidden", { status: 403, headers });

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

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, origin);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400, origin);
  }

  const description = (body as any).description;
  const rawTags = (body as any).tags;

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

  const tags: string[] = Array.isArray(rawTags) ? (rawTags as string[]) : [];

  if (!description || typeof description !== "string") {
    return jsonError("Missing 'description' (string)", 400, origin);
  }
  if (description.length < 20) {
    return jsonError("Description too short (min 20 chars)", 400, origin);
  }
  if (description.length > 4000) {
    return jsonError("Description too long (max 4000 chars)", 400, origin);
  }

  try {
    const { text } = await runBot({ description, tags });

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
  } catch (e) {
    return NextResponse.json(
      { error: "Bot execution failed", details: String(e) },
      { status: 502, headers }
    );
  }*/
}
