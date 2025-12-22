// app/api/sets/[setId]/price-history/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { RAKUTEN_LEGO_RETAILER } from "@/lib/retailer";

function safeRetailer(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  // Optional guard: limit length so nobody passes insane strings
  if (s.length > 64) return null;
  return s;
}

// ✅ Must await context.params in App Router
export async function GET(
  req: Request,
  context: { params: Promise<{ setId: string }> }
) {
  const { setId } = await context.params;

  if (!setId) {
    return NextResponse.json({ error: "❌ Missing setId param" }, { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const retailerParam = safeRetailer(url.searchParams.get("retailer"));

    let history = [];

    if (retailerParam) {
      history = await prisma.priceHistory.findMany({
        where: { setIdRef: setId, retailer: retailerParam as any },
        orderBy: { recordedAt: "asc" },
      });
    } else {
      history = await prisma.priceHistory.findMany({
        where: { setIdRef: setId, retailer: "LEGO" },
        orderBy: { recordedAt: "asc" },
      });

      if (history.length === 0) {
        history = await prisma.priceHistory.findMany({
          where: { setIdRef: setId, retailer: { not: RAKUTEN_LEGO_RETAILER } },
          orderBy: { recordedAt: "asc" },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      setId,
      retailer: retailerParam ?? null,
      history,
    });
  } catch (error) {
    console.error("❌ Failed to fetch price history:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching price history" },
      { status: 500 }
    );
  }
}
