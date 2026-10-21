// src/app/api/v1/chat/route.ts
import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { getFileSearchStoreName } from "@/lib/gemini";
import { chatRequestSchema } from "@/lib/schema";
import { buildChatPrompt } from "@/lib/bot/prompt";
import { runRagChat } from "@/lib/gemini/rag";
import { extractEmailTemplate } from "@/lib/parser/email";
import {
  buildLatestInsightsContext,
  getLatestInsightSources,
  isInsightsFreshnessQuery,
  getLatestInsightsLimit,
} from "@/lib/rag/insights";
import { selectProjectLinks } from "@/lib/rag/project-links";
import { selectVisibleSources } from "@/lib/rag/sources";
import {
  finishChatTracking,
  isChatTrackingEnabled,
  startChatTracking,
} from "@/lib/analytics/chat-tracking";
import { parseChatAnalyticsMetadata } from "@/lib/analytics/request-metadata";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const { headers } = corsHeaders(origin);

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const { headers, isAllowed } = corsHeaders(origin);

  if (!isAllowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || "unknown";

  const rl = await rateLimitHourly(ip);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(rl.resetSeconds),
        },
      },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers },
    );
  }

  const { message, conversation } = parsed.data;

  const isInsightsFreshness = isInsightsFreshnessQuery(message);

  const latestInsightsLimit = isInsightsFreshness
    ? getLatestInsightsLimit(message)
    : 0;

  const latestInsightsContext = isInsightsFreshness
    ? buildLatestInsightsContext(latestInsightsLimit)
    : undefined;

  const latestInsightSources = isInsightsFreshness
    ? getLatestInsightSources(latestInsightsLimit)
    : [];

  const prompt = buildChatPrompt({
    message,
    latestInsightsContext,
  });

  const storeName = getFileSearchStoreName();

  // Read analytics separately so invalid metadata cannot reject a valid message.
  const metadata = isChatTrackingEnabled()
    ? parseChatAnalyticsMetadata(body)
    : null;

  const tracking = metadata
    ? await startChatTracking({
        ...metadata,
        visitorId: null,
      })
    : null;

  let errorStage: "model" | "response_processing" = "model";
  let generationDurationMs: number | null = null;

  // Exclude analytics recording and response processing from generation time.
  const generationStartedAt = performance.now();

  try {
    const { text, sources } = await runRagChat({
      model: "gemini-3.8-flash",
      prompt,
      history: conversation?.history,
      fileSearchStoreNames: [storeName],
    });

    generationDurationMs = Math.round(performance.now() - generationStartedAt);

    errorStage = "response_processing";

    if (!text.trim()) {
      const response = NextResponse.json(
        {
          text: "Il me manque un peu de contexte pour te répondre précisément - tu peux préciser ?",
        },
        { headers },
      );

      await finishChatTracking(tracking, {
        status: "failed",
        generationDurationMs,
        errorStage: "model",
        errorCode: "empty_response",
      });

      return response;
    }

    const email = extractEmailTemplate(text);

    const visibleSources =
      latestInsightSources.length > 0
        ? latestInsightSources
        : selectVisibleSources(message, sources);

    const response = NextResponse.json(
      {
        text,
        email,
        sources,
        visibleSources,
        projectLinks: selectProjectLinks(text),
      },
      { headers },
    );

    await finishChatTracking(tracking, {
      status: "generated",
      generationDurationMs,
    });

    return response;
  } catch (error: unknown) {
    if (generationDurationMs === null) {
      generationDurationMs = Math.round(
        performance.now() - generationStartedAt,
      );
    }

    await finishChatTracking(tracking, {
      status: "failed",
      generationDurationMs,
      errorStage,
      errorCode:
        errorStage === "model" ? "model_error" : "response_processing_error",
    });

    const details = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: "Model error", details },
      { status: 500, headers },
    );
  }
}
