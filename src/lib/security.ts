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

export function jsonError(
  message: string,
  status: number,
  origin: string | null
) {
  const { headers } = corsHeaders(origin);
  return NextResponse.json({ error: message }, { status, headers });
}
