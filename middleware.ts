import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    return NextResponse.json({ error: "ADMIN_API_KEY not set" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}