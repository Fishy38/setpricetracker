// app/giftcards/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { headers } from "next/headers";
import { formatCentsUsd } from "@/lib/utils";

type GiftCardRow = {
  id: string;
  rakutenProductId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  canonicalUrl: string | null;
  destinationUrl: string | null;
  affiliateUrl: string | null;
  price: number | null; // cents
};

async function getBaseUrlFromHeaders(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;

  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function GiftCardsPage() {
  const base =
    (await getBaseUrlFromHeaders()) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const res = await fetch(new URL("/api/giftcards", base), {
    cache: "no-store",
  });

  const rows = (await res.json().catch(() => [])) as GiftCardRow[];

  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-3">Gift Cards</h1>
        <p className="text-gray-400 max-w-2xl">
          Gift card deals powered by Rakuten affiliate links. (This is separate
          from LEGO sets.)
        </p>
      </header>

      <section className="w-full max-w-6xl">
        {(!rows || rows.length === 0) && (
          <div className="border border-gray-800 rounded-md p-4 bg-gray-950">
            <p className="text-sm text-gray-300">
              No gift cards in the database yet.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Go to Admin → click “Refresh Gift Cards”.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(rows ?? []).map((g) => {
            const dest =
              g.affiliateUrl || g.canonicalUrl || g.destinationUrl || "#";

            const cid =
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

            // Route through /out so you always have an audit trail + can inject u1 for Rakuten
            const tracked = `/out?u=${encodeURIComponent(dest)}&cid=${encodeURIComponent(
              cid
            )}&giftcardId=${encodeURIComponent(g.rakutenProductId)}`;

            return (
              <a
                key={g.id}
                href={tracked}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="border border-gray-800 rounded-md p-3 hover:border-gray-600 hover:bg-gray-900 transition"
              >
                <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-800 mb-3 bg-black relative">
                  {g.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.imageUrl}
                      alt={g.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      No image
                    </div>
                  )}
                </div>

                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {g.brand ?? "Gift Card"}
                </div>

                <div className="text-sm text-gray-200 font-semibold mb-1 line-clamp-2">
                  {g.name}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-green-400 font-semibold">
                    {formatCentsUsd(g.price)}
                  </span>
                  <span className="text-xs text-gray-400">Open deal →</span>
                </div>
              </a>
            );
          })}
        </div>

        <footer className="mt-16 text-sm text-gray-500 text-center">
          <p className="mb-2">As an affiliate, we may earn from qualifying purchases.</p>
          <p>© {year} SetPriceTracker</p>
        </footer>
      </section>
    </main>
  );
}
