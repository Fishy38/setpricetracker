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
import { parsePriceToCents } from "@/lib/utils";
import type { Retailer } from "@prisma/client";

// ✅ Build absolute origin safely (works on Vercel w/out NEXT_PUBLIC_SITE_URL)
function getOriginFromRequest(req: Request) {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = xfHost ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (!host) return null;
  return `${proto}://${host}`;
}

// Helper to build affiliate deep link via our API
async function buildAffiliateUrl(
  req: Request,
  merchantId: string,
  destinationUrl: string
): Promise<string | null> {
  try {
    const origin = getOriginFromRequest(req);
    if (!origin) return null;

    const res = await fetch(`${origin}/api/rakuten/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId, destinationUrl }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.affiliateLink || null;
  } catch (err) {
    console.error("Affiliate URL generation failed", err);
    return null;
  }
}

export async function POST(req: Request) {
  // ✅ Allow unauthenticated access in dev mode
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.SEED_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "SEED_SECRET not set" }, { status: 500 });
    }

    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const merchantId = process.env.RAKUTEN_ADVERTISER_ID;
  if (!merchantId) {
    console.warn("⚠️ RAKUTEN_ADVERTISER_ID not set — LEGO links may not be tracked.");
  }

  for (const s of SETS as any[]) {
    const setId = String(s.setId);
    const imageUrl = String(s.imageUrl);
    const msrpCents = parsePriceToCents(s.msrp);

    const legoUrlStored =
      typeof s.legoUrl === "string" && s.legoUrl.trim().length
        ? s.legoUrl.trim()
        : null;

    // 1) Upsert Set
    await prisma.set.upsert({
      where: { setId },
      update: {
        name: s.name ?? null,
        imageUrl,
        msrp: msrpCents,
        legoUrl: legoUrlStored,
      },
      create: {
        setId,
        name: s.name ?? null,
        imageUrl,
        msrp: msrpCents,
        legoUrl: legoUrlStored,
      },
    });

    // 2) Build LEGO affiliate link
    const destinationUrl = legoUrlStored ?? legoSearchUrl(setId);
    let legoAffiliateUrl: string | null = null;

    if (merchantId && destinationUrl) {
      // ✅ FIX: build absolute URL from request headers
      legoAffiliateUrl = await buildAffiliateUrl(req, merchantId, destinationUrl);
    }

    if (!legoAffiliateUrl) {
      const offerId =
        typeof s.rakutenOfferId === "string" && s.rakutenOfferId.trim().length
          ? s.rakutenOfferId.trim()
          : undefined;

      legoAffiliateUrl = legoAffiliateUrlFromProductPage({
        setId,
        destinationUrl,
        offerId,
      });
    }

    // 3) Upsert Offers + Conditional PriceHistory insert
    const offers: { retailer: Retailer; url: string; price: number | null }[] = [
      { retailer: "LEGO", url: legoAffiliateUrl!, price: msrpCents },
      { retailer: "Amazon", url: amazonSearchUrl(setId), price: null },
      { retailer: "Walmart", url: walmartSearchUrl(setId), price: null },
      { retailer: "Target", url: targetSearchUrl(setId), price: null },
    ];

    for (const o of offers) {
      await prisma.offer.upsert({
        where: {
          setIdRef_retailer: {
            setIdRef: setId,
            retailer: o.retailer,
          },
        },
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

      // ✅ Insert into PriceHistory if price/inStock changed
      const lastHistory = await prisma.priceHistory.findFirst({
        where: { setIdRef: setId, retailer: o.retailer },
        orderBy: { recordedAt: "desc" },
      });

      const changed =
        lastHistory?.price !== o.price || lastHistory?.inStock !== true;

      if (changed) {
        await prisma.priceHistory.create({
          data: {
            setIdRef: setId,
            retailer: o.retailer,
            price: o.price,
            inStock: true,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, seeded: SETS.length });
}