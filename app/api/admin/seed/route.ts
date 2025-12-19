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
  legoSearchUrl,
  legoAffiliateUrlFromProductPage,
} from "@/lib/affiliate";

type Retailer = "LEGO" | "Amazon" | "Walmart" | "Target";

function dollarsToCents(msrp?: string | number | null): number | null {
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
    const setId = String(s.setId);
    const imageUrl = String(s.imageUrl);

    const legoUrlStored =
      typeof s.legoUrl === "string" && s.legoUrl.trim().length ? s.legoUrl.trim() : null;

    // 1) Upsert Set (includes legoUrl)
    await prisma.set.upsert({
      where: { setId },
      update: {
        name: s.name ?? null,
        imageUrl,
        msrp: dollarsToCents(s.msrp),
        legoUrl: legoUrlStored,
      },
      create: {
        setId,
        name: s.name ?? null,
        imageUrl,
        msrp: dollarsToCents(s.msrp),
        legoUrl: legoUrlStored,
      },
    });

    // 2) Build affiliate LEGO url (Rakuten) pointing at product page when possible
    const destinationUrl = legoUrlStored ?? legoSearchUrl(setId);

    const offerId =
      typeof s.rakutenOfferId === "string" && s.rakutenOfferId.trim().length
        ? s.rakutenOfferId.trim()
        : undefined;

    const legoAffiliateUrl = legoAffiliateUrlFromProductPage({
      setId,
      destinationUrl,
      offerId,
    });

    // 3) Upsert offers (LEGO gets affiliate url; other retailers are search urls for now)
    const offers: { retailer: Retailer; url: string; price: number | null }[] = [
      { retailer: "LEGO", url: legoAffiliateUrl, price: dollarsToCents(s.msrp) },
      { retailer: "Amazon", url: amazonSearchUrl(setId), price: null },
      { retailer: "Walmart", url: walmartSearchUrl(setId), price: null },
      { retailer: "Target", url: targetSearchUrl(setId), price: null },
    ];

    for (const o of offers) {
      await prisma.offer.upsert({
        where: { setIdRef_retailer: { setIdRef: setId, retailer: o.retailer } },
        update: {
          url: o.url,
          price: o.price,
          inStock: true,
          updatedAt: new Date(),
        },
        create: {
          setIdRef: setId,
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