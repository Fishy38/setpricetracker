// middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "./utils/rateLimit";
import {
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from "./lib/admin-session";

export const config = {
  matcher: ["/api/admin/:path*", "/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const expected = process.env.ADMIN_API_KEY;
  const auth = req.headers.get("authorization") || "";
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  const pathname = req.nextUrl.pathname;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/login";

  if (process.env.NODE_ENV === "development") {
    console.log("[MIDDLEWARE] Skipping auth in dev mode for:", pathname);
    return NextResponse.next();
  }

  if (isLoginPage || isLoginApi) {
    return NextResponse.next();
  }

  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    console.warn("[RATE_LIMIT_BLOCKED]", {
      ip,
      path: pathname,
      retryAfter,
      time: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter },
      { status: 429 }
    );
  }

  const cronKeyHeader =
    req.headers.get("x-cron-key") ||
    req.headers.get("x-cron-secret") ||
    "";
  const cronSecret = process.env.CRON_SECRET || "";

  const cookieValue = req.cookies.get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(cookieValue);

  const hasSession = session.ok;
  const hasApiKey = Boolean(expected && auth === `Bearer ${expected}`);
  const hasCron = Boolean(cronSecret && cronKeyHeader === cronSecret);

  console.log("[ADMIN_API_CALL]", {
    method: req.method,
    path: pathname,
    ip,
    userAgent: req.headers.get("user-agent"),
    authorized: hasSession || hasApiKey || hasCron,
    time: new Date().toISOString(),
  });

  if (isAdminPage) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (isAdminApi) {
    if (!hasSession && !hasApiKey && !hasCron) {
      console.warn("[ADMIN_API_CALL] Unauthorized", { ip });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}
