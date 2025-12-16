// src/lib/security.ts
import { NextResponse } from "next/server";

export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null) {
  const allowed = getAllowedOrigins();

  // Si pas d'origin (ex: curl, server-to-server), on autorise.
  // Si tu veux être plus strict, tu peux refuser origin=null.
  const isAllowed = !origin || allowed.includes(origin);

  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (isAllowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return { headers, isAllowed };
}

// ---- Rate limit V1 (in-memory) ----
type Bucket = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(ip: string) {
  const perHour = parseInt(process.env.RATE_LIMIT_PER_HOUR || "60", 10);
  const burst = parseInt(process.env.RATE_LIMIT_BURST || "10", 10);

  const now = Date.now();
  const refillPerMs = perHour / (60 * 60 * 1000); // tokens/ms
  const key = ip || "unknown";

  const existing = buckets.get(key) ?? { tokens: burst, lastRefillMs: now };

  const elapsed = now - existing.lastRefillMs;
  const refill = elapsed * refillPerMs;
  const newTokens = Math.min(burst, existing.tokens + refill);

  const allowed = newTokens >= 1;

  const updated: Bucket = {
    tokens: allowed ? newTokens - 1 : newTokens,
    lastRefillMs: now,
  };

  buckets.set(key, updated);

  return {
    allowed,
    remaining: Math.floor(updated.tokens),
    retryAfterSeconds: allowed
      ? 0
      : Math.ceil((1 - updated.tokens) / refillPerMs / 1000),
  };
}

export function jsonError(
  message: string,
  status: number,
  origin: string | null
) {
  const { headers } = corsHeaders(origin);
  return NextResponse.json({ error: message }, { status, headers });
}
