// middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "./utils/rateLimit";

export const config = {
  matcher: ["/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const expected = process.env.ADMIN_API_KEY;
  const auth = req.headers.get("authorization") || "";
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  const pathname = req.nextUrl.pathname;

  // ✅ Bypass ALL admin auth checks locally in development
  if (process.env.NODE_ENV === "development") {
    console.log("[MIDDLEWARE] ✅ Skipping auth in dev mode for:", pathname);
    return NextResponse.next();
  }

  // 🧠 Rate limit
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

  // 📝 Log all admin access attempts
  console.log("[ADMIN_API_CALL]", {
    method: req.method,
    path: pathname,
    ip,
    userAgent: req.headers.get("user-agent"),
    authorized: auth === `Bearer ${expected}`,
    time: new Date().toISOString(),
  });

  // 🔐 Auth enforcement
  if (!expected) {
    console.error("[ADMIN_API_CALL] Missing API key");
    return NextResponse.json({ error: "ADMIN_API_KEY not set" }, { status: 500 });
  }

  if (auth !== `Bearer ${expected}`) {
    console.warn("[ADMIN_API_CALL] Unauthorized", { ip });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}