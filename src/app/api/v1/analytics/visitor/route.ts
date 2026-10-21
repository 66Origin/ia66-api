import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders } from "@/lib/security";
import {
  createVisitorToken,
  verifyVisitorToken,
} from "@/lib/analytics/visitor-token";

const requestSchema = z.object({
  visitorToken: z.unknown().optional(),
});

// Development-only duration, pending the production retention decision.
const TOKEN_DURATION_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.O_ANALYTICS_ENABLED !== "true"
  ) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const origin = request.headers.get("origin");
  const { headers: cors, isAllowed } = corsHeaders(origin);
  const headers = {
    ...cors,
    "Cache-Control": "no-store",
  };

  if (!isAllowed) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers,
    });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers },
    );
  }

  try {
    const existingToken =
      typeof parsed.data.visitorToken === "string"
        ? parsed.data.visitorToken
        : null;

    const recognized = verifyVisitorToken(existingToken);

    if (existingToken && recognized) {
      return NextResponse.json(
        {
          visitorToken: existingToken,
          expiresAt: recognized.expiresAt,
        },
        { headers },
      );
    }

    const visitorId = randomUUID();
    const expiresAt = Date.now() + TOKEN_DURATION_MS;
    const visitorToken = createVisitorToken(visitorId, expiresAt);

    return NextResponse.json({ visitorToken, expiresAt }, { headers });
  } catch {
    console.error("[analytics] Could not issue visitor token.");

    return NextResponse.json(
      { error: "Visitor recognition unavailable" },
      { status: 503, headers },
    );
  }
}
