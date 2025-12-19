// prisma/seed.ts
import { prisma } from "../lib/prisma";
import { SETS } from "../lib/sets";
import {
  amazonSearchUrl,
  walmartSearchUrl,
  targetSearchUrl,
  legoAffiliateUrlFromProductPage,
} from "../lib/affiliate";

type Retailer = "LEGO" | "Amazon" | "Walmart" | "Target";

function dollarsToCents(msrp?: string | number | null) {
  if (msrp == null) return null;
  if (typeof msrp === "number") return Math.round(msrp * 100);

  // if msrp is string like "$199.99" or "199.99"
  const cleaned = String(msrp).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

async function main() {
  for (const s of SETS as any[]) {
    // Expecting at minimum: { setId, imageUrl, name?, msrp? }
    // Optional (for product-page affiliate links):
    // - s.legoUrl (exact product page URL)
    // - s.rakutenOfferId (offerid from Rakuten "Copy link code")
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

    const legoUrl = legoAffiliateUrlFromProductPage({
      setId: s.setId,
      destinationUrl: s.legoUrl, // preferred: exact product page
      offerId: s.rakutenOfferId, // required for Rakuten "link" format affiliate URL
    });

    const offers: { retailer: Retailer; url: string; price: number | null }[] = [
      {
        retailer: "LEGO",
        url: legoUrl,
        price: dollarsToCents(s.msrp), // placeholder (MSRP)
      },
      { retailer: "Amazon", url: amazonSearchUrl(s.setId), price: null },
      { retailer: "Walmart", url: walmartSearchUrl(s.setId), price: null },
      { retailer: "Target", url: targetSearchUrl(s.setId), price: null },
    ];

    for (const o of offers) {
      await prisma.offer.upsert({
        where: {
          setIdRef_retailer: {
            setIdRef: s.setId, // references Set.setId (LEGO number)
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
          setIdRef: s.setId,
          retailer: o.retailer,
          url: o.url,
          price: o.price,
          inStock: true,
        },
      });
    }
  }

  console.log(`Seeded ${SETS.length} sets + offers`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });