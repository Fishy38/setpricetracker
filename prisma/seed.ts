// prisma/seed.ts
import { prisma } from "../lib/prisma";
import { SETS } from "../lib/sets";
import {
  amazonSearchUrl,
  walmartSearchUrl,
  targetSearchUrl,
  legoAffiliateUrlFromProductPage,
} from "../lib/affiliate";

import { parsePriceToCents } from "../lib/utils";
import type { Retailer } from "@prisma/client";

async function main() {
  for (const s of SETS as any[]) {
    const setId = String(s.setId);
    const imageUrl = String(s.imageUrl);
    const msrpCents = parsePriceToCents(s.msrp);

    // 1) Upsert Set
    await prisma.set.upsert({
      where: { setId },
      update: {
        name: s.name ?? null,
        imageUrl,
        msrp: msrpCents,
      },
      create: {
        setId,
        name: s.name ?? null,
        imageUrl,
        msrp: msrpCents,
      },
    });

    // 2) Build affiliate LEGO link
    const legoUrl = legoAffiliateUrlFromProductPage({
      setId,
      destinationUrl: s.legoUrl,
      offerId: s.rakutenOfferId,
    });

    // 3) Offers for all retailers
    const offers: { retailer: Retailer; url: string; price: number | null }[] = [
      { retailer: "LEGO", url: legoUrl, price: msrpCents },
      { retailer: "Amazon", url: amazonSearchUrl(setId), price: null },
      { retailer: "Walmart", url: walmartSearchUrl(setId), price: null },
      { retailer: "Target", url: targetSearchUrl(setId), price: null },
    ];

    for (const o of offers) {
      // Upsert offer row
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

      // Conditionally insert into price history
      const last = await prisma.priceHistory.findFirst({
        where: { setIdRef: setId, retailer: o.retailer },
        orderBy: { recordedAt: "desc" },
      });

      const changed = last?.price !== o.price || last?.inStock !== true;

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

  console.log(`✅ Seeded ${SETS.length} sets + offers`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });