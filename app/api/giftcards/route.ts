// app/api/giftcards/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.giftCardOffer.findMany({
    // ✅ sort by price ascending (nulls last), then brand/name
    orderBy: [
      { price: { sort: "asc", nulls: "last" } },
      { brand: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      rakutenProductId: true,
      name: true,
      brand: true,
      imageUrl: true,
      canonicalUrl: true,
      destinationUrl: true,
      affiliateUrl: true,
      price: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(rows);
}