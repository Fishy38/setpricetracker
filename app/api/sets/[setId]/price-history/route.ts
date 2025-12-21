// app/api/sets/[setId]/price-history/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Retailer } from "@prisma/client";

function coerceRetailer(v: string | null): Retailer | null {
  if (!v) return null;
  const s = v.trim();

  // Accept exact enum keys/values like "LEGO", "Amazon", etc.
  if (s in Retailer) return Retailer[s as keyof typeof Retailer];

  return null;
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
    const retailerParam = url.searchParams.get("retailer");
    const retailer = coerceRetailer(retailerParam);

    const history = await prisma.priceHistory.findMany({
      where: {
        setIdRef: setId,
        ...(retailer ? { retailer } : {}),
      },
      orderBy: { recordedAt: "asc" }, // oldest to newest
    });

    return NextResponse.json({
      ok: true,
      setId,
      retailer: retailer ?? null,
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