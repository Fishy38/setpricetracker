// app/api/sets/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function bestOfferFromOffers(offers: any[]) {
  const priced = (offers ?? []).filter((o) => o?.price != null);
  if (!priced.length) return null;
  priced.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const o = priced[0];
  return {
    retailer: o.retailer,
    price: o.price, // cents
    url: o.url,
    inStock: o.inStock,
    updatedAt: o.updatedAt,
  };
}

export async function GET() {
  const sets = await prisma.set.findMany({
    orderBy: { setId: "asc" },
    include: { offers: true, clicks: true },
  });

  const shaped = sets.map((s) => {
    const offers = s.offers.map((o) => ({
      retailer: o.retailer,
      price: o.price, // cents or null
      url: o.url,
      inStock: o.inStock,
      updatedAt: o.updatedAt,
    }));

    return {
      setId: s.setId,
      name: s.name,
      imageUrl: s.imageUrl,
      msrp: s.msrp, // cents
      bestOffer: bestOfferFromOffers(offers),
      offers,
      clicks: (s.clicks ?? []).reduce((acc, c) => {
        acc[c.retailer] = c.count;
        return acc;
      }, {} as Record<string, number>),
    };
  });

  return NextResponse.json(shaped);
}