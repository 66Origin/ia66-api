import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "./lib/admin-session";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/api/v1/admin/login",
  "/api/v1/admin/logout",
]);

/**
 * First barrier for the administration section. Every protected page and
 * route still checks the session itself.
 *
 * /api/v1/rag/export and /api/v1/filesearch keep their own token checks:
 * they are called by scripts and by the RAG agent, not from a browser
 * session.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (verifyAdminSessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/v1/admin/:path*"],
};
