// app/api/admin/giftcards-refresh/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;

  const target = new URL("/api/refresh/giftcards", base);
  target.search = url.search;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.CRON_SECRET) headers["x-cron-key"] = process.env.CRON_SECRET;

  const res = await fetch(target, {
    method: "POST",
    headers,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "text/plain";
  const body = await res.text().catch(() => "");

  if (!res.ok) {
    return new NextResponse(
      `Gift cards refresh failed: ${res.status}\n\n${body}`,
      { status: 500 }
    );
  }

  // return JSON cleanly if it is JSON
  if (contentType.includes("application/json")) {
    try {
      return NextResponse.json(JSON.parse(body));
    } catch {
      // fall through to raw response
    }
  }

  return new NextResponse(body, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

export async function POST(req: Request) {
  return GET(req);
}
