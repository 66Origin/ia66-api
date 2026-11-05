import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminSessionToken,
  isAdminAccessConfigured,
  safeAdminRedirect,
  verifyAdminPassword,
} from "@/lib/admin-session";
import { rateLimitHourly } from "@/lib/ratelimit/hourly";

function back(request: Request, error: string, next: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("error", error);
  url.searchParams.set("next", next);

  // 303 turns the form POST into a GET on the login page.
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const next = safeAdminRedirect(form?.get("next"));

  if (!isAdminAccessConfigured()) {
    return back(request, "config", next);
  }

  const xff = request.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || "unknown";

  // Separate counter from the chat, to slow down password guessing.
  const limit = await rateLimitHourly(`admin-login:${ip}`);

  if (!limit.allowed) {
    return back(request, "limit", next);
  }

  if (!verifyAdminPassword(form?.get("password"))) {
    return back(request, "password", next);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);

  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
  });

  return response;
}
