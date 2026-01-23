// app/api/v1/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { runBot } from "@/lib/bot/run";
import { chatInputSchema } from "@/lib/schema";

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

  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, origin);
  }
  const parsedResult = chatInputSchema.safeParse(rawBody);

  if (!parsedResult.success) {
    const first = parsedResult.error.issues[0];
    return jsonError(first?.message || "Invalid request body", 400, origin);
  }

  const { description, tags } = parsedResult.data;

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
  }
}
