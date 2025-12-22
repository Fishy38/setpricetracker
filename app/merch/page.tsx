// app/merch/page.tsx
import Link from "next/link";
import { formatRetailerLabel } from "@/lib/retailer";
import { formatCentsUsd } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiOffer = {
  retailer: string;
  price: number | null; // cents
  url?: string | null;
  inStock?: boolean | null;
};

type ApiRow = {
  setId: string;
  name?: string | null;
  imageUrl: string;
  offers: ApiOffer[];
  bestOffer?: ApiOffer | null;
  productType?: string | null;
  inferredType?: string | null;
};

export default async function MerchPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const res = await fetch(`${base}/api/sets?type=MERCH`, { cache: "no-store" }).catch(() => null);
  const items: ApiRow[] = res && res.ok ? await res.json() : [];

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-3">Merch</h1>
        <p className="text-gray-400 max-w-xl">
          Apparel, collectibles, accessories, storage, books, puzzles, and other non-set LEGO merch.
        </p>

        <div className="mt-4">
          <Link href="/" className="underline text-gray-300 hover:text-white">
            ← Back to sets
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="text-gray-400">No merch found yet.</div>
      ) : (
        <section className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((it) => {
            const best = it.bestOffer ?? null;
            const price = best?.price ?? null;

            return (
              <Link key={it.setId} href={`/set/${it.setId}`} className="w-full">
                <div className="border border-gray-800 rounded-md p-3 hover:border-gray-600 hover:bg-gray-900 transition cursor-pointer">
                  <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-800 mb-3 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.imageUrl}
                      alt={it.name ?? it.setId}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="text-sm text-gray-300 mb-1 line-clamp-2">{it.name ?? it.setId}</div>
                  <div className="text-sm text-gray-400 mb-1">
                    {formatRetailerLabel(best?.retailer)}
                  </div>
                  <div className="text-green-400 font-semibold">
                    {formatCentsUsd(price)}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
