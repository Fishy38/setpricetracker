// app/api/sets/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // 5 minutes

export async function GET() {
  const sets = await prisma.set.findMany({
    orderBy: { setId: "asc" },
    include: {
      offers: true,
      clicks: true,
    },
  });

  const shaped = sets.map((s) => ({
    setId: s.setId,
    name: s.name,
    imageUrl: s.imageUrl,
    msrp: s.msrp,
    offers: s.offers.map((o) => ({
      retailer: o.retailer,
      price: o.price,
      url: o.url, // ✅ your schema field
      inStock: o.inStock,
      updatedAt: o.updatedAt,
    })),
    clicks: s.clicks.reduce<Record<string, number>>((acc, c) => {
      acc[c.retailer] = c.count;
      return acc;
    }, {}),
  }));

  return NextResponse.json(shaped);
}