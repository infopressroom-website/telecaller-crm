import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// First line of defence only: checks the cookie EXISTS. Real validation (expiry, revocation,
// deactivation, permissions) happens server-side in layouts, pages, actions and API handlers.
// Webhooks and the scheduler authenticate themselves (secret in the URL / Bearer token), not with a session cookie.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/api/health", "/api/webhooks", "/api/cron"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isPublic && !req.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
