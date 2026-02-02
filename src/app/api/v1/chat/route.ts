// app/api/v1/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, jsonError } from "@/lib/security";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";
import { getFileSearchStoreName, getGeminiClient } from "@/lib/gemini";
import { chatRequestSchema } from "@/lib/schema";
import { buildChatPrompt } from "@/lib/bot/prompt";

function enforceNoQuestion(text: string) {
  let out = text.replace(/\n?QUESTION:\s*[\s\S]*$/i, "").trim();
  out = out.replace(/\?/g, "");
  return out.trim();
}

function looksLikeNumberedSummary(text: string) {
  return /(^|\n)\s*\d+\s*[\.\)\-]\s+/m.test(text);
}

function hasDocLimitStatement(text: string) {
  return /je ne le vois pas|je ne vois pas|je ne trouve pas|pas d'informations|n'est pas disponible dans les documents actuels|pas disponible dans les documents actuels|documents actuels.*ne contiennent pas|sans accès au texte/i.test(
    text,
  );
}

function buildNewsDocMissingFallback(args: {
  pageTitle?: string;
  pageSlug?: string;
  turn: number;
  maxTurns: number;
}) {
  const { pageTitle, pageSlug, turn, maxTurns } = args;
  const articleLabel = pageTitle || pageSlug || "cet article";

  const lines: string[] = [
    "ACQUIS:",
    `- Demande : résumé de ${articleLabel}.`,
    "- Contexte : page d’actualité (news_article).",
    "",
    "ORIENTATION:",
    "Je ne le vois pas dans les documents actuels. Sans le contenu de l’article, je ne peux pas produire un résumé fiable.",
    "",
    "SUITE:",
    "- Fournir le texte complet de l’article (copier-coller) ou un extrait.",
    "- Indiquer l’URL directe de l’article pour que le contenu soit indexé côté documents.",
  ];

  if (turn < maxTurns) {
    lines.push(
      "",
      "QUESTION:",
      "Préférez-vous coller le texte ici, ou partager l’URL directe de l’article ?",
    );
  }

  return lines.join("\n");
}

function enforceNewsArticleNoInventedSummary(args: {
  text: string;
  pageContext?: { pageType?: string; pageTitle?: string; pageSlug?: string };
  message: string;
  turn: number;
  maxTurns: number;
}) {
  const { text, pageContext, message, turn, maxTurns } = args;

  const isNewsArticle = pageContext?.pageType === "news_article";
  if (!isNewsArticle) return text;

  const asksForSummary = /résume|résumé|points clés|en \d+ points/i.test(
    message,
  );
  if (!asksForSummary) return text;

  const hasNumbered = looksLikeNumberedSummary(text);
  const claimsSummary =
    /voici un résumé|résumé en \d+ points|en \d+ points/i.test(text);

  // Si le modèle produit un "résumé" structuré mais sans limite doc => on remplace par un fallback.
  if ((hasNumbered || claimsSummary) && !hasDocLimitStatement(text)) {
    return buildNewsDocMissingFallback({
      pageTitle: pageContext?.pageTitle,
      pageSlug: pageContext?.pageSlug,
      turn,
      maxTurns,
    });
  }

  return text;
}

function enforceCaseMetricsDocLimit(args: {
  text: string;
  entrypoint?: string;
  pageContext?: { pageType?: string; pageSlug?: string; pageTitle?: string };
  message: string;
}) {
  const { text, entrypoint, pageContext, message } = args;

  const isCase = entrypoint === "case" || pageContext?.pageType === "case";
  if (!isCase) return text;

  const asksMetrics =
    /(résultats?\s*chiffr|kpi|indicateurs|chiffres|mesur|impact\s*mesur)/i.test(
      message,
    );
  if (!asksMetrics) return text;

  // On exige : doc-limit + mention explicite "résultats chiffrés"
  const hasExplicitMetricsWording = /résultats?\s*chiffr/i.test(text);
  const hasLimit =
    hasDocLimitStatement(text) ||
    /ne\s+(détaillent|mentionnent)\s+pas\s+de\s+résultats?\s*chiffr/i.test(
      text,
    );

  if (hasExplicitMetricsWording && hasLimit) return text;

  const inject =
    "Je ne le vois pas dans les documents actuels : les documents ne mentionnent pas de résultats chiffrés.";

  if (/(\n|^)ORIENTATION:\s*\n/i.test(text)) {
    return text.replace(/(\n|^)ORIENTATION:\s*\n/i, (m) => `${m}${inject}\n`);
  }

  return `${inject}\n\n${text}`.trim();
}

function enforceAcquisMaxBullets(text: string, maxBullets = 3) {
  const m = text.match(/(^|\n)ACQUIS:\s*\n([\s\S]*?)(\nORIENTATION:)/i);
  if (!m) return text;

  const acquisBody = m[2];
  const lines = acquisBody.split("\n");

  const bulletIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*[-*]\s+/.test(lines[i])) bulletIdx.push(i);
  }
  if (bulletIdx.length <= maxBullets) return text;

  const keep = bulletIdx.slice(0, maxBullets);
  const extra = bulletIdx.slice(maxBullets);

  const firstExtraLine = extra[0];
  const lastExtraLine = extra[extra.length - 1];
  const keptLastLineIdx = keep[keep.length - 1];

  const extraTexts = lines
    .slice(firstExtraLine, lastExtraLine + 1)
    .filter((l) => /^\s*[-*]\s+/.test(l))
    .map((l) => l.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);

  const keptText = lines[keptLastLineIdx].replace(/^\s*[-*]\s+/, "").trim();
  const merged = [keptText, ...extraTexts].filter(Boolean).join(" ; ");
  lines[keptLastLineIdx] = `- ${merged}`;

  for (let i = extra.length - 1; i >= 0; i--) {
    lines.splice(extra[i], 1);
  }

  const newAcquisBody = lines.join("\n");
  return text.replace(acquisBody, newAcquisBody);
}

function ensureDocLimitPhrase(text: string) {
  const canon = "Je ne le vois pas dans les documents actuels.";
  const hasCanon = /je ne le vois pas dans les documents actuels\./i.test(text);

  const signalsMissing =
    /ne (contien(nent)?|détaille(nent)?|mentionne(nt)?) pas|n'est pas disponible|pas disponible|impossible de|je ne (trouve|vois) pas/i.test(
      text,
    );

  if (signalsMissing && !hasCanon) {
    if (/^\s*ORIENTATION:\s*$/im.test(text)) {
      return text.replace(/^\s*ORIENTATION:\s*$/im, `ORIENTATION:\n${canon}`);
    }
    return `${canon}\n\n${text}`.trim();
  }
  return text;
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

  let finalText = isFinal ? enforceNoQuestion(text) : text;

  // Guard: news_article anti hallucination (résumés inventés)
  finalText = enforceNewsArticleNoInventedSummary({
    text: finalText,
    pageContext,
    message,
    turn,
    maxTurns,
  });

  // Guard: case metrics => phrase canon + "résultats chiffrés"
  finalText = enforceCaseMetricsDocLimit({
    text: finalText,
    entrypoint,
    pageContext,
    message,
  });

  // Stabilisation doc-limit canon quand info manquante
  finalText = ensureDocLimitPhrase(finalText);

  // Stabilisation bullets (ACQUIS max 3)
  finalText = enforceAcquisMaxBullets(finalText, 3);

  // Réappliquer le guard de tour (si un fallback a injecté '?')
  if (isFinal) finalText = enforceNoQuestion(finalText);

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
