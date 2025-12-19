// app/set/[setId]/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SETS } from "@/lib/sets";

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
    if (ap == null) return 1; // nulls last
    if (bp == null) return -1;
    return ap - bp; // lowest first
  });
}

export default async function SetPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;

  const dbSet = await prisma.set.findUnique({
    where: { setId },
    include: { offers: true },
  });

  const set = dbSet ?? SETS.find((s) => s.setId === setId) ?? null;

  if (!set) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Set not found</h1>
        <p className="text-gray-400 mb-6">Looked for: {String(setId)}</p>
        <Link href="/" className="underline text-gray-300 hover:text-white">
          ← Back to home
        </Link>
      </main>
    );
  }

  const offersSorted = sortOffersByPrice(((set as any)?.offers ?? []) as any[]);

  // ✅ Hide retailers that don't have price data (and still require URL)
  const offersToShow = offersSorted.filter(
    (o: any) => !!o?.url && o?.price != null
  );

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <header className="w-full max-w-5xl mb-8">
        <Link href="/" className="text-gray-400 hover:text-white underline">
          ← Back
        </Link>
      </header>

      <section className="w-full max-w-5xl grid grid-cols-2 gap-8">
        {/* Left */}
        <div className="border border-gray-800 rounded-md p-4">
          <img
            src={(set as any).imageUrl}
            alt={`LEGO set ${(set as any).setId}`}
            className="w-full aspect-square object-cover rounded-md border border-gray-800 bg-black"
          />
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Set
            </div>
            <div className="text-3xl font-bold">{(set as any).setId}</div>
            {(set as any).name && (
              <div className="text-gray-400 mt-1">{(set as any).name}</div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="border border-gray-800 rounded-md p-4">
          <h2 className="text-xl font-semibold mb-3">Retailers</h2>

          {offersToShow.length === 0 ? (
            <div className="text-sm text-gray-400">
              No live prices yet for this set.
            </div>
          ) : (
            <div className="space-y-3">
              {offersToShow.map((o: any, idx: number) => (
                <a
                  key={`${o.retailer}-${idx}`}
                  href={`/out?u=${encodeURIComponent(
                    o.url
                  )}&setId=${encodeURIComponent(
                    (set as any).setId
                  )}&retailer=${encodeURIComponent(o.retailer)}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="flex justify-between items-center border border-gray-800 rounded-md px-4 py-3 hover:border-gray-600 hover:bg-gray-900 transition"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{o.retailer}</span>
                    <span className="text-xs text-gray-500">Open deal</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {(set as any).msrp != null && (
                      <span className="text-xs text-gray-500 line-through">
                        {formatCents((set as any).msrp)}
                      </span>
                    )}
                    <span className="text-green-400 font-semibold">
                      {formatCents(o.price)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            Links go through /out for tracking (beta).
          </p>
        </div>
      </section>
    </main>
  );
}