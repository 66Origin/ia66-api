// app/api/v1/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { getFileSearchStoreName, getGeminiClient } from "@/lib/gemini";
import { chatRequestSchema } from "@/lib/schema";
import { buildChatPrompt } from "@/lib/bot/prompt";

function enforceNoQuestion(text: string) {
  // Remove any trailing QUESTION: block
  let out = text.replace(/\n?QUESTION:\s*[\s\S]*$/i, "").trim();
  // Remove any remaining question marks
  out = out.replace(/\?/g, "");
  return out.trim();
}

function looksLikeNumberedSummary(text: string) {
  // 1. / 1) / 1 - (les 3 formats les plus courants)
  return /(^|\n)\s*\d+\s*[\.\)\-]\s+/m.test(text);
}

function hasDocLimitStatement(text: string) {
  return /je ne le vois pas|je ne vois pas|je ne trouve pas|pas d'informations|n'est pas disponible dans les documents actuels|pas disponible dans les documents actuels|documents actuels.*ne contiennent pas|sans accès au texte/i.test(
    text,
  );
}

function buildNewsDocMissingFallback(args: {
  message: string;
  pageTitle?: string;
  pageSlug?: string;
  turn: number;
  maxTurns: number;
}) {
  const { message, pageTitle, pageSlug, turn, maxTurns } = args;
  const articleLabel = pageTitle || pageSlug || "cet article";

  // IMPORTANT: pas de "?" hors QUESTION.
  const lines: string[] = [
    "ACQUIS:",
    `- Demande : résumé de ${articleLabel}.`,
    "- Contexte : page d’actualité (news_article).",
    "",
    "ORIENTATION:",
    "Je ne le vois pas dans les documents actuels. Sans le contenu de l’article, je ne peux pas produire un résumé fiable.",
    "",
    "SUITE:",
    "- Envoyer le texte de l’article (copier-coller) ou un extrait.",
    "- Ou partager le lien exact/public de l’article pour que le contenu soit indexé côté documents.",
  ];

  if (turn < maxTurns) {
    lines.push(
      "",
      "QUESTION:",
      "Préférez-vous coller le texte ici, ou partager le lien exact de l’article ?",
    );
  }

  return lines.join("\n");
}

function enforceNewsArticleNoInventedSummary(args: {
  text: string;
  entrypoint?: string;
  pageContext?: { pageType?: string; pageTitle?: string; pageSlug?: string };
  message: string;
  turn: number;
  maxTurns: number;
}) {
  const { text, pageContext, message, turn, maxTurns } = args;

  // On déclenche surtout sur pageType news_article (plus fiable que entrypoint).
  const isNewsArticle = pageContext?.pageType === "news_article";
  if (!isNewsArticle) return text;

  const asksForSummary = /résume|résumé|points clés|en \d+ points/i.test(
    message,
  );
  if (!asksForSummary) return text;

  // Cas à bloquer : liste numérotée / "résumé en X points" sans mention claire de limite docs.
  const hasNumbered = looksLikeNumberedSummary(text);
  const claimsSummary =
    /voici un résumé|résumé en \d+ points|en \d+ points/i.test(text);

  if ((hasNumbered || claimsSummary) && !hasDocLimitStatement(text)) {
    return buildNewsDocMissingFallback({
      message,
      pageTitle: pageContext?.pageTitle,
      pageSlug: pageContext?.pageSlug,
      turn,
      maxTurns,
    });
  }

  return text;
}

function enforceAcquisMaxBullets(text: string, maxBullets: number) {
  const acquisMatch = text.match(/ACQUIS:\s*([\s\S]*?)(\n[A-Z]+:|$)/i);
  if (!acquisMatch) return text;

  const acquisContent = acquisMatch[1];
  const bullets = acquisContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"));

  if (bullets.length <= maxBullets) return text;

  // Rebuild ACQUIS with limited bullets
  const limitedAcquis =
    "ACQUIS:\n" + bullets.slice(0, maxBullets).join("\n") + "\n";

  return text.replace(
    /ACQUIS:\s*([\s\S]*?)(\n[A-Z]+:|$)/i,
    limitedAcquis + "$2",
  );
}

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
      },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, origin);
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400, headers },
    );
  }

  // Include conversation + userProfileHint so turn/maxTurns/history reach the prompt.
  const { message, entrypoint, pageContext, conversation, userProfileHint } =
    parsed.data;

  const prompt =
    typeof buildChatPrompt === "function"
      ? buildChatPrompt({
          message,
          entrypoint,
          pageContext,
          conversation,
          userProfileHint,
        })
      : `
Tu es "IA 66", assistant de 66 Origin.
Réponds en français. Ne jamais inventer.
Contexte page: ${JSON.stringify(pageContext ?? { pageType: "other" })}
Entrypoint: ${entrypoint ?? "other"}

Message utilisateur:
${message}
`.trim();

  const ai = getGeminiClient();
  const storeName = getFileSearchStoreName();

  console.log("TURN", conversation?.turn, "MAX", conversation?.maxTurns);

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Gemini call failed", details: String(e) },
      { status: 502, headers },
    );
  }

  const text = response.text;
  if (!text) {
    return NextResponse.json(
      { error: "Gemini response has no text output" },
      { status: 502, headers },
    );
  }

  const turn = conversation?.turn ?? 1;
  const maxTurns = conversation?.maxTurns ?? 5;

  const isFinal = turn >= maxTurns;

  let finalText = turn >= maxTurns ? enforceNoQuestion(text) : text;

  finalText = enforceNewsArticleNoInventedSummary({
    text: finalText,
    entrypoint,
    pageContext,
    message,
    turn,
    maxTurns,
  });

  if (turn >= maxTurns) {
    finalText = enforceNoQuestion(finalText);
  }

  return NextResponse.json(
    { text: finalText, isFinal },
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
}
