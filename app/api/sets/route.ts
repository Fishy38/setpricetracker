// app/api/sets/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sets = await prisma.set.findMany({
    orderBy: { setId: "asc" },
    include: { offers: true, clicks: true },
  });

  const shaped = sets.map((s) => {
    const offers = (s.offers ?? []).map((o) => ({
      retailer: o.retailer, // enum
      price: o.price, // cents or null
      url: o.url,
      inStock: o.inStock,
      updatedAt: o.updatedAt,
    }));

    // choose bestOffer: lowest non-null price; if none, null
    const bestOffer =
      offers
        .filter((o) => typeof o.price === "number")
        .sort((a, b) => (a.price! - b.price!))[0] ?? null;

    const msrpCents = s.msrp ?? null;

    const discountCents =
      msrpCents != null && bestOffer?.price != null ? msrpCents - bestOffer.price : null;

    const discountPct =
      msrpCents != null && bestOffer?.price != null && msrpCents > 0
        ? Math.round(((msrpCents - bestOffer.price) / msrpCents) * 100)
        : null;

    return {
      setId: s.setId,
      name: s.name,
      imageUrl: s.imageUrl,
      msrp: s.msrp, // cents
      offers,
      bestOffer,
      discountCents,
      discountPct,
      clicks: (s.clicks ?? []).reduce((acc, c) => {
        acc[String(c.retailer)] = c.count;
        return acc;
      }, {} as Record<string, number>),
    };
  });

  return NextResponse.json(shaped);
}