// app/set/[setId]/page.tsx
import Link from "next/link";
import { PriceChart } from "@/app/components/PriceChart";
import { prisma } from "@/lib/prisma";
import { formatRetailerLabel, retailerKey, RAKUTEN_LEGO_RETAILER } from "@/lib/retailer";
import { SETS } from "@/lib/sets";
import { getServerOrigin } from "@/lib/server-origin";
import { formatCentsUsd } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sortOffersByPrice(offers: any[]) {
  return [...(offers ?? [])].sort((a, b) => {
    const ap = a?.price ?? null;
    const bp = b?.price ?? null;
    if (ap == null && bp == null) return 0;
    if (ap == null) return 1;
    if (bp == null) return -1;
    return ap - bp;
  });
}

function dedupeOffersByRetailer(offers: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];

  for (const o of offers ?? []) {
    const key = o?.retailerKey ?? "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }

  return out;
}

const LEGO_RETAILER = "LEGO";

function mergeRakutenLegoOffer(offers: any[]) {
  let rakuten: any = null;
  const out: any[] = [];

  for (const o of offers ?? []) {
    const key = String(o?.retailer ?? "").trim().toUpperCase();
    if (key === RAKUTEN_LEGO_RETAILER) {
      rakuten = o;
      continue;
    }
    out.push(o);
  }

  if (rakuten?.url) {
    const legoIdx = out.findIndex(
      (o) => String(o?.retailer ?? "").trim().toUpperCase() === LEGO_RETAILER
    );
    if (legoIdx >= 0) {
      out[legoIdx] = { ...out[legoIdx], url: rakuten.url };
    } else {
      out.push({
        ...rakuten,
        retailer: LEGO_RETAILER,
      });
    }
  }

  return out;
}

type PageProps = {
  params: Promise<{ setId: string }> | { setId: string };
};

export default async function SetPage({ params }: PageProps) {
  const resolvedParams = await params;
  const setId = resolvedParams?.setId;

  if (!setId) throw new Error("Missing setId");

  const dbSet = await prisma.set.findUnique({
    where: { setId },
    include: { offers: true },
  });

  const set = dbSet ?? SETS.find((s) => s.setId === setId) ?? null;

  if (!set) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Set not found</h1>
        <Link href="/" className="underline text-gray-300 hover:text-white">
          ← Back to home
        </Link>
      </main>
    );
  }

  const offersMerged = mergeRakutenLegoOffer((set as any).offers ?? []);
  const offersSorted = sortOffersByPrice(offersMerged);

  const offersNormalized = offersSorted.map((o: any) => ({
    ...o,
    retailerLabel: formatRetailerLabel(o?.retailer),
    retailerKey: retailerKey(o?.retailer),
  }));

  // lowest price wins, regardless of retailer:
  // - prefer priced, in-stock offers with URL
  // - fall back to priced offers
  // - if no prices exist, still show linked offers
  const inStockOffers = offersNormalized.filter(
    (o: any) => o?.url && o?.price != null && o?.inStock !== false
  );
  const fallbackOffers = offersNormalized.filter((o: any) => o?.url && o?.price != null);
  const linkedOffers = offersNormalized.filter((o: any) => o?.url);

  const offersToShow = dedupeOffersByRetailer(
    inStockOffers.length
      ? inStockOffers
      : fallbackOffers.length
        ? fallbackOffers
        : linkedOffers
  );

  const origin = await getServerOrigin();

  let priceHistory: any[] = [];
  try {
    const res = await fetch(
      new URL(`/api/sets/${encodeURIComponent(setId)}/price-history`, origin),
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      priceHistory = data?.history ?? [];
    }
  } catch {}

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <section className="w-full max-w-5xl grid grid-cols-2 gap-8">
        {/* LEFT */}
        <div className="border border-gray-800 rounded-md p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={(set as any).imageUrl}
            className="w-full aspect-square object-cover rounded-md border border-gray-800"
            alt={(set as any).name ?? `LEGO Set ${setId}`}
          />
          <div className="mt-4">
            <div className="text-xs uppercase text-gray-500">Set</div>
            <div className="text-3xl font-bold">{setId}</div>
            {(set as any).name && <div className="text-gray-400">{(set as any).name}</div>}
          </div>
        </div>

        {/* RIGHT */}
        <div className="border border-gray-800 rounded-md p-4">
          <h2 className="text-xl font-semibold mb-3">Retailers</h2>

          {offersToShow.length === 0 ? (
            <div className="text-sm text-gray-500">No offers available.</div>
          ) : (
            offersToShow.map((o: any, i: number) => {
              // cid correlates click -> conversion (Rakuten u1 anti-hijack signal)
              const cid =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

              const msrp = (set as any).msrp ?? null;
              const showMsrpStrike =
                typeof msrp === "number" && typeof o.price === "number" && msrp > o.price;

              return (
                <a
                  key={i}
                  href={`/out?u=${encodeURIComponent(o.url)}&setId=${encodeURIComponent(
                    setId
                  )}&retailer=${encodeURIComponent(o.retailerLabel)}&cid=${encodeURIComponent(
                    cid
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="flex justify-between items-center border border-gray-800 rounded-md px-4 py-3 hover:bg-gray-900"
                >
                  <div>
                    <div className="font-medium">{o.retailerLabel}</div>
                    <div className="text-xs text-gray-500">
                      {o.inStock === false ? "Out of stock" : "Open deal"}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {showMsrpStrike && (
                      <span className="text-xs line-through text-gray-500">
                        {formatCentsUsd(msrp)}
                      </span>
                    )}
                    <span className="text-green-400 font-semibold">
                      {formatCentsUsd(o.price)}
                    </span>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </section>

      <section className="w-full max-w-5xl mt-12">
        <h2 className="text-xl font-semibold mb-4">Price History</h2>
        {priceHistory.length > 0 ? (
          <div className="bg-zinc-900 border border-gray-800 rounded-md p-4">
            <PriceChart history={priceHistory} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No price history available.</p>
        )}
      </section>
    </main>
  );
}
