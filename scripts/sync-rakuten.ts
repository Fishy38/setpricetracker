// scripts/sync-rakuten.ts

import "dotenv/config";
import { shouldIncludeProduct } from "@/lib/rakuten/shouldIncludeProduct";
import { fetchAllLegoProducts } from "@/lib/rakuten";
import { parsePriceToCents } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

async function main() {
  const products = await fetchAllLegoProducts();
  let synced = 0;
  let skipped = 0;

  for (const item of products) {
    const setId =
      item?.upccode?.[0]?.trim() ||
      item?.sku?.[0]?.trim() ||
      item?.upccode?.trim() ||
      item?.sku?.trim() ||
      null;

    const nameRaw = item?.productname;
    const name =
      Array.isArray(nameRaw) && nameRaw.length > 0 ? nameRaw[0] : nameRaw ?? null;

    const imageUrl = item?.imageurl?.[0] ?? item?.imageurl ?? null;
    const legoUrl = item?.linkurl?.[0] ?? item?.linkurl ?? null;

    const rawPrice =
      item?.price?.[0]?._ ?? item?.price?.[0] ?? item?.price?._ ?? item?.price ?? null;
    const priceCents = parsePriceToCents(rawPrice);
    const inStock = priceCents !== null;

    // 🔍 Normalize product before filtering
    const normalizedItem = {
      ...item,
      productname: name,
    };

    if (!shouldIncludeProduct(normalizedItem)) {
      console.warn("⛔ Skipping non-set:", name);
      skipped++;
      continue;
    }

    if (!setId || !imageUrl) {
      console.warn("⚠️ Skipping product (missing setId/imageUrl):", {
        setId,
        imageUrl,
        rawPrice,
        priceCents,
      });
      skipped++;
      continue;
    }

    // 1) Upsert Set
    await prisma.set.upsert({
      where: { setId },
      update: {
        name,
        imageUrl,
        msrp: priceCents,
        legoUrl,
        canonicalUrl: legoUrl,
        advertiserId: process.env.RAKUTEN_LEGO_MID ?? null,
        lastSyncedAt: new Date(),
      },
      create: {
        setId,
        name,
        imageUrl,
        msrp: priceCents,
        legoUrl,
        canonicalUrl: legoUrl,
        advertiserId: process.env.RAKUTEN_LEGO_MID ?? null,
        lastSyncedAt: new Date(),
      },
    });

    // 2) Upsert Offer
    await prisma.offer.upsert({
      where: {
        setIdRef_retailer: {
          setIdRef: setId,
          retailer: "LEGO",
        },
      },
      update: {
        price: priceCents,
        url: legoUrl,
        inStock,
        updatedAt: new Date(),
      },
      create: {
        setIdRef: setId,
        retailer: "LEGO",
        price: priceCents,
        url: legoUrl,
        inStock,
      },
    });

    // 3) Insert price history only if changed
    const last = await prisma.priceHistory.findFirst({
      where: { setIdRef: setId, retailer: "LEGO" },
      orderBy: { recordedAt: "desc" },
    });

    const changed = last?.price !== priceCents || last?.inStock !== inStock;

    if (changed) {
      await prisma.priceHistory.create({
        data: {
          setIdRef: setId,
          retailer: "LEGO",
          price: priceCents,
          inStock,
        },
      });
    }

    synced++;
  }

  console.log(`✅ Synced ${synced} sets from Rakuten. Skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error("❌ Rakuten sync failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });