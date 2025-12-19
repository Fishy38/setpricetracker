// prisma/seed.ts
import { prisma } from "../lib/prisma";
import { SETS } from "../lib/sets";
import {
  amazonSearchUrl,
  walmartSearchUrl,
  targetSearchUrl,
  legoSearchUrl,
  legoAffiliateUrlFromProductPage,
  rakutenOfferLink,
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

function centsToDisplay(cents: number | null) {
  if (cents == null) return null;
  return cents; // keep stored as cents in DB; your UI can format
}

async function main() {
  for (const s of SETS as any[]) {
    // Upsert Set
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

    /**
     * LEGO affiliate URL logic (priority order):
     * 1) If you have rakutenOfferId + legoProductUrl -> generate exact Rakuten “link” URL
     * 2) Else if you have legoProductUrl -> generate Rakuten deeplink to that product page
     * 3) Else -> fallback to LEGO search page (non-ideal, but never breaks)
     */
    const legoUrl: string = (() => {
      const productUrl = s.legoProductUrl as string | undefined;
      const offerId = s.rakutenOfferId as string | undefined;

      if (productUrl && offerId) {
        return rakutenOfferLink({
          destinationUrl: productUrl,
          offerId,
          type: 2,
        });
      }

      if (productUrl) {
        return legoAffiliateUrlFromProductPage(productUrl, s.setId);
      }

      return legoSearchUrl(s.setId);
    })();

    const offers: { retailer: Retailer; url: string; price: number | null }[] = [
      // Use MSRP as placeholder price for LEGO offer
      { retailer: "LEGO", url: legoUrl, price: dollarsToCents(s.msrp) },
      { retailer: "Amazon", url: amazonSearchUrl(s.setId), price: null },
      { retailer: "Walmart", url: walmartSearchUrl(s.setId), price: null },
      { retailer: "Target", url: targetSearchUrl(s.setId), price: null },
    ];

    for (const o of offers) {
      await prisma.offer.upsert({
        where: {
          setIdRef_retailer: {
            setIdRef: s.setId, // references Set.setId
            retailer: o.retailer,
          },
        },
        update: {
          url: o.url,
          price: centsToDisplay(o.price),
          inStock: true,
          updatedAt: new Date(),
        },
        create: {
          setIdRef: s.setId,
          retailer: o.retailer,
          url: o.url,
          price: centsToDisplay(o.price),
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