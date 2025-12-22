// app/api/admin/refresh-prices/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { refreshAmazonAll } from "@/app/api/refresh/amazon/route";
import { refreshLegoAll } from "@/app/api/refresh/lego/route";

// Build absolute origin safely (works on Vercel w/out NEXT_PUBLIC_SITE_URL)
function getOriginFromRequest(req: Request) {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = xfHost ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (!host) return null;
  return `${proto}://${host}`;
}

function parseLimit(value: string | null, fallback: number) {
  const raw = Number(value ?? "");
  return Number.isFinite(raw) ? Math.max(1, Math.min(10, Math.floor(raw))) : fallback;
}

function parseTake(value: string | null) {
  const raw = Number(value ?? "");
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

export async function POST(req: Request) {
  const origin = getOriginFromRequest(req);
  if (!origin) {
    return NextResponse.json({ ok: false, error: "Missing host" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"), 2);
  const take = parseTake(url.searchParams.get("take"));

  console.log(`[ADMIN_REFRESH_PRICES] start limit=${limit} take=${take}`);
  const [legoResult, amazonResult] = await Promise.all([
    refreshLegoAll({ limit, take }),
    refreshAmazonAll({ limit, take }),
  ]);
  const ok = legoResult.ok && amazonResult.ok;

  console.log(
    `[ADMIN_REFRESH_PRICES] done ok=${ok} legoRefreshed=${legoResult.refreshed} amazonRefreshed=${amazonResult.refreshed}`
  );
  return NextResponse.json(
    {
      ok,
      lego: legoResult,
      amazon: amazonResult,
    },
    { status: ok ? 200 : 502 }
  );
}

export async function GET(req: Request) {
  return POST(req);
}
