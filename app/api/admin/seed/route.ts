// app/api/admin/seed/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SETS } from "@/lib/sets";
import {
  amazonSearchUrl,
  walmartSearchUrl,
  targetSearchUrl,
  legoRakutenProductUrl,
  legoSearchUrl,
} from "@/lib/affiliate";

type Retailer = "LEGO" | "Amazon" | "Walmart" | "Target";

function dollarsToCents(msrp?: string | number | null) {
  if (msrp == null) return null;
  if (typeof msrp === "number") return Math.round(msrp * 100);
  const cleaned = String(msrp).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEED_SECRET not set" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  for (const s of SETS as any[]) {
    await prisma.set.upsert({
      where: { setId: s.setId },
      update: {
        name: s.name ?? null,
        imageUrl: s.imageUrl,
        msrp: dollarsToCents(s.msrp),
      },
      create: {
        setId: s.setId,
        name: s.name ?? null,
        imageUrl: s.imageUrl,
        msrp: dollarsToCents(s.msrp),
      },
    });

    // Prefer exact LEGO product URL if you store it on the set
    const legoDestination =
      typeof s.legoUrl === "string" && s.legoUrl.length
        ? s.legoUrl
        : legoSearchUrl(String(s.setId));

    // If offerId exists, generate the Rakuten product affiliate link
    const legoUrl =
      typeof s.rakutenOfferId === "string" && s.rakutenOfferId.length
        ? legoRakutenProductUrl({
            setId: String(s.setId),
            destinationUrl: legoDestination,
            offerId: String(s.rakutenOfferId),
          })
        : legoDestination;

    const offers: { retailer: Retailer; url: string; price: number | null }[] = [
      { retailer: "LEGO", url: legoUrl, price: dollarsToCents(s.msrp) },
      { retailer: "Amazon", url: amazonSearchUrl(String(s.setId)), price: null },
      { retailer: "Walmart", url: walmartSearchUrl(String(s.setId)), price: null },
      { retailer: "Target", url: targetSearchUrl(String(s.setId)), price: null },
    ];

    for (const o of offers) {
      await prisma.offer.upsert({
        where: {
          setIdRef_retailer: { setIdRef: s.setId, retailer: o.retailer },
        },
        update: {
          url: o.url,
          price: o.price,
          inStock: true,
          updatedAt: new Date(),
        },
        create: {
          setIdRef: s.setId,
          retailer: o.retailer,
          url: o.url,
          price: o.price,
          inStock: true,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, seeded: SETS.length });
}