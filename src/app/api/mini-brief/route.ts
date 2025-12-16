import { NextResponse } from "next/server";
import { corsHeaders, jsonError, rateLimit } from "@/lib/security";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);

  if (!isAllowed) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);

  if (!isAllowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || "unknown";

  const rl = rateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const description = body?.description;

  if (!description || typeof description !== "string") {
    return jsonError("Missing 'description' (string)", 400, origin);
  }

  if (description.length < 20) {
    return jsonError("Description too short (min 20 chars)", 400, origin);
  }

  if (description.length > 4000) {
    return jsonError("Description too long (max 4000 chars)", 400, origin);
  }

  return NextResponse.json(
    {
      miniBrief: {
        resume: "OK — API sécurisée (CORS + rate limit) en place",
        objectifs: [],
        livrables: [],
        planning_estime: "",
      },
      similarCases: [],
      pitchAgence: "",
    },
    { status: 200, headers }
  );
}
