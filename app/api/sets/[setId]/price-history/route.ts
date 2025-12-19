// app/api/sets/[setId]/price-history/route.ts

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ Must await context.params in App Router
export async function GET(
  req: Request,
  context: { params: Promise<{ setId: string }> }
) {
  const { setId } = await context.params;

  if (!setId) {
    return NextResponse.json(
      { error: "❌ Missing setId param" },
      { status: 400 }
    );
  }

  try {
    const url = new URL(req.url);
    const retailer = url.searchParams.get("retailer");

    const history = await prisma.priceHistory.findMany({
      where: {
        setIdRef: setId,
        ...(retailer ? { retailer } : {}),
      },
      orderBy: { recordedAt: "asc" }, // oldest to newest
    });

    console.log(
      `✅ Found ${history.length} history entries for setId=${setId}${
        retailer ? ` & retailer=${retailer}` : ""
      }`
    );

    return NextResponse.json({
      ok: true,
      setId,
      retailer: retailer || null,
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