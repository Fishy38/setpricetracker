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

// Helper to build affiliate deep link via our API
async function buildAffiliateUrl(merchantId: string, destinationUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/rakuten/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId, destinationUrl }),
    });
    const data = await res.json();
    return data.affiliateLink || null;
  } catch (err) {
    console.error("Affiliate URL generation failed", err);
    return null;
  }
}

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

  const merchantId = process.env.RAKUTEN_ADVERTISER_ID;
  if (!merchantId) {
    console.warn("Warning: RAKUTEN_ADVERTISER_ID not set — LEGO links may not be tracked.");
  }

  for (const s of SETS as any[]) {
    const setId = String(s.setId);
    const imageUrl = String(s.imageUrl);
    const msrp = dollarsToCents(s.msrp);

    const legoUrlStored =
      typeof s.legoUrl === "string" && s.legoUrl.trim().length ? s.legoUrl.trim() : null;

    // 1) Upsert Set (includes legoUrl)
    await prisma.set.upsert({
      where: { setId },
      update: {
        name: s.name ?? null,
        imageUrl,
        msrp,
        legoUrl: legoUrlStored,
      },
      create: {
        setId,
        name: s.name ?? null,
        imageUrl,
        msrp,
        legoUrl: legoUrlStored,
      },
    });

    // 2) Build affiliate LEGO URL
    const destinationUrl = legoUrlStored ?? legoSearchUrl(setId);

    // Try using canonical affiliate link via Rakuten API
    let legoAffiliateUrl: string | null = null;
    if (merchantId && destinationUrl) {
      legoAffiliateUrl = await buildAffiliateUrl(merchantId, destinationUrl);
    }

    // If that failed, fall back to rakutenOfferId
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

    // 3) Upsert Offers
    const offers: { retailer: Retailer; url: string; price: number | null }[] = [
      { retailer: "LEGO", url: legoAffiliateUrl!, price: msrp },
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