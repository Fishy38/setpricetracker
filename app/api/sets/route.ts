export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sets = await prisma.set.findMany({
    orderBy: { setId: "asc" },
    include: { offers: true, clicks: true },
  });

  const shaped = sets.map((s) => ({
    setId: s.setId,
    name: s.name,
    imageUrl: s.imageUrl,
    msrp: s.msrp, // cents
    offers: s.offers.map((o) => ({
      retailer: o.retailer,
      price: o.price, // cents or null
      url: o.url,
      inStock: o.inStock,
      updatedAt: o.updatedAt,
    })),
    clicks: (s.clicks ?? []).reduce((acc, c) => {
      acc[c.retailer] = c.count;
      return acc;
    }, {} as Record<string, number>),
  }));

  return NextResponse.json(shaped);
}