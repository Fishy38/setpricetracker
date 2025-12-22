// app/set/[setId]/page.tsx
import Link from "next/link";
import { PriceChart } from "@/app/components/PriceChart";
import { prisma } from "@/lib/prisma";
import { SETS } from "@/lib/sets";
import { getServerOrigin } from "@/lib/server-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

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

  const offersSorted = sortOffersByPrice((set as any).offers ?? []);

  // ✅ lowest price wins, regardless of retailer:
  // - show only priced offers with URL
  // - prefer inStock !== false
  const inStockOffers = offersSorted.filter(
    (o: any) => o?.url && o?.price != null && o?.inStock !== false
  );
  const fallbackOffers = offersSorted.filter((o: any) => o?.url && o?.price != null);

  const offersToShow = (inStockOffers.length ? inStockOffers : fallbackOffers).map((o: any) => ({
    ...o,
    retailer: String(o.retailer),
  }));

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
                  )}&retailer=${encodeURIComponent(o.retailer)}&cid=${encodeURIComponent(cid)}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="flex justify-between items-center border border-gray-800 rounded-md px-4 py-3 hover:bg-gray-900"
                >
                  <div>
                    <div className="font-medium">{o.retailer}</div>
                    <div className="text-xs text-gray-500">
                      {o.inStock === false ? "Out of stock" : "Open deal"}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {showMsrpStrike && (
                      <span className="text-xs line-through text-gray-500">
                        {formatCents(msrp)}
                      </span>
                    )}
                    <span className="text-green-400 font-semibold">{formatCents(o.price)}</span>
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