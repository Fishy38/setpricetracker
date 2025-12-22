// app/api/sets/[setId]/price-history/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

    const history = await prisma.priceHistory.findMany({
      where: {
        setIdRef: setId,
        ...(retailerParam ? { retailer: retailerParam as any } : {}),
      },
      orderBy: { recordedAt: "asc" }, // oldest to newest
    });

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