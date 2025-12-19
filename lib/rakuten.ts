// lib/rakuten.ts

import { parseStringPromise } from "xml2js";
import { prisma } from "./prisma";
import { parsePriceToCents } from "./utils";

const PRODUCT_SEARCH_URL = "https://productsearch.linksynergy.com/productsearch";

export function getDeepLink(merchantId: string, destinationUrl: string): string {
  return `https://click.linksynergy.com/deeplink?id=${process.env.RAKUTEN_PUBLISHER_ID}&mid=${merchantId}&murl=${encodeURIComponent(destinationUrl)}`;
}

export async function fetchAllLegoProducts(): Promise<any[]> {
  const advertiserId = process.env.RAKUTEN_LEGO_MID;
  const publisherId = process.env.RAKUTEN_PUBLISHER_ID;

  if (!advertiserId || !publisherId) {
    throw new Error("Missing Rakuten credentials");
  }

  const results: any[] = [];
  const max = 100;
  let page = 1;

  while (true) {
    const url = new URL(PRODUCT_SEARCH_URL);
    url.searchParams.set("publisherId", publisherId);
    url.searchParams.set("mid", advertiserId);
    url.searchParams.set("max", max.toString());
    url.searchParams.set("pagenumber", page.toString());

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/xml" },
    });

    const text = await res.text();
    const data = await parseStringPromise(text);
    const products = data?.result?.item ?? [];

    if (products.length === 0) break;

    results.push(...products);
    console.log(`📦 Page ${page}: Fetched ${products.length}`);
    page++;

    if (page > 50) break;
  }

  console.log(`✅ Total LEGO products: ${results.length}`);
  return results;
}

export async function refreshLegoProductsWithHistory(): Promise<{ synced: number; skipped: number }> {
  const items = await fetchAllLegoProducts();
  let synced = 0;
  let skipped = 0;

  for (const item of items) {
    const setId = item?.sku?.[0]?.trim();
    const name = item?.productname?.[0]?.trim();
    const imageUrl = item?.imageurl?.[0];
    const price = parsePriceToCents(item?.price?.[0]);
    const inStock = price !== null;
    const legoUrl = item?.linkurl?.[0];
    const advertiserId = item?.mid?.[0];
    const rakutenProductId = item?.offerid?.[0];

    if (!setId || !imageUrl) {
      skipped++;
      continue;
    }

    // 1) Upsert set
    await prisma.set.upsert({
      where: { setId },
      create: {
        setId,
        name,
        imageUrl,
        msrp: price,
        legoUrl,
        advertiserId,
        rakutenProductId,
        canonicalUrl: legoUrl,
      },
      update: {
        name,
        imageUrl,
        msrp: price,
        legoUrl,
        advertiserId,
        rakutenProductId,
        canonicalUrl: legoUrl,
        updatedAt: new Date(),
      },
    });

    // 2) Upsert offer
    await prisma.offer.upsert({
      where: {
        setIdRef_retailer: {
          setIdRef: setId,
          retailer: "LEGO",
        },
      },
      create: {
        setIdRef: setId,
        retailer: "LEGO",
        price,
        url: legoUrl ?? null,
        inStock,
      },
      update: {
        price,
        url: legoUrl ?? null,
        inStock,
        updatedAt: new Date(),
      },
    });

    // ✅ 3) Only insert price history if price/inStock changed
    const lastHistory = await prisma.priceHistory.findFirst({
      where: { setIdRef: setId, retailer: "LEGO" },
      orderBy: { recordedAt: "desc" },
    });

    const changed = lastHistory?.price !== price || lastHistory?.inStock !== inStock;

    if (changed) {
      await prisma.priceHistory.create({
        data: {
          setIdRef: setId,
          retailer: "LEGO",
          price,
          inStock,
        },
      });
    }

    console.log(`✅ Synced LEGO set ${setId}`);
    synced++;
  }

  return { synced, skipped };
}