// app/api/rakuten/sync/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllLegoProducts } from "@/lib/rakuten";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dollarsToCents(price?: string): number | null {
  if (!price) return null;
  const num = parseFloat(price);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

function buildLegoAffiliateLink(destinationUrl: string): string {
  return `https://click.linksynergy.com/deeplink?id=${process.env.RAKUTEN_PUBLISHER_ID}&mid=${process.env.RAKUTEN_LEGO_MID}&murl=${encodeURIComponent(destinationUrl)}`;
}

export async function POST(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await fetchAllLegoProducts();

    let successCount = 0;
    let skipped = 0;

    for (const p of products) {
      const setIdMatch = p.sku?.match(/\d{3,5}/)?.[0];
      if (!setIdMatch || !p.url || !p.productName) {
        skipped++;
        continue;
      }

      const existing = await prisma.set.findUnique({ where: { setId: setIdMatch } });
      if (existing?.canonicalUrl) {
        skipped++;
        continue;
      }

      const msrp = dollarsToCents(p.price);
      const affiliateUrl = buildLegoAffiliateLink(p.url);

      // Upsert Set
      await prisma.set.upsert({
        where: { setId: setIdMatch },
        update: {
          name: p.productName,
          imageUrl: p.imageUrl,
          msrp,
          legoUrl: p.url,
          canonicalUrl: p.url,
          rakutenProductId: p.productId,
          advertiserId: p.advertiserId,
          lastSyncedAt: new Date(),
        },
        create: {
          setId: setIdMatch,
          name: p.productName,
          imageUrl: p.imageUrl,
          msrp,
          legoUrl: p.url,
          canonicalUrl: p.url,
          rakutenProductId: p.productId,
          advertiserId: p.advertiserId,
          lastSyncedAt: new Date(),
        },
      });

      // Upsert LEGO Offer
      await prisma.offer.upsert({
        where: {
          setIdRef_retailer: {
            setIdRef: setIdMatch,
            retailer: "LEGO",
          },
        },
        update: {
          url: affiliateUrl,
          price: msrp,
          inStock: true,
          updatedAt: new Date(),
        },
        create: {
          setIdRef: setIdMatch,
          retailer: "LEGO",
          url: affiliateUrl,
          price: msrp,
          inStock: true,
        },
      });

      successCount++;
    }

    return NextResponse.json({
      ok: true,
      synced: successCount,
      skipped,
    });
  } catch (err: any) {
    console.error("❌ Rakuten sync failed:", err);
    return NextResponse.json(
      { error: "Failed to sync Rakuten LEGO products", details: err.message },
      { status: 500 }
    );
  }
}