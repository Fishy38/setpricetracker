"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SETS } from "../../../lib/sets";

export default function SetPage() {
  const params = useParams();
  const setIdRaw = params?.setId;
  const setId = Array.isArray(setIdRaw)
    ? setIdRaw[0]
    : (setIdRaw as string | undefined);

  const set = SETS.find((s) => s.setId === setId);

  // ✅ click counts (hidden from UI, used internally)
  const [clicks, setClicks] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!set?.setId) return;

    fetch(`/api/clicks?setId=${encodeURIComponent(set.setId)}`)
      .then((r) => r.json())
      .then((data) => setClicks(data ?? {}))
      .catch(() => setClicks({}));
  }, [set?.setId]);

  // still available for future use
  const getCount = (retailer: string) =>
    clicks[`${set?.setId}::${retailer}`] ?? 0;

  if (!setId || !set) {
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
            src={set.imageUrl}
            alt={`LEGO set ${set.setId}`}
            className="w-full aspect-square object-cover rounded-md border border-gray-800 bg-black"
          />

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Set</div>
            <div className="text-3xl font-bold">{set.setId}</div>
            {set.name && <div className="text-gray-400 mt-1">{set.name}</div>}
          </div>
        </div>

        {/* Right */}
        <div className="border border-gray-800 rounded-md p-4">
          <h2 className="text-xl font-semibold mb-3">Retailers</h2>

          <div className="space-y-3">
            {set.offers.map((o, idx) => (
              <a
                key={idx}
                href={`/out?u=${encodeURIComponent(o.affiliateUrl)}&setId=${encodeURIComponent(
                  set.setId
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
                  {set.msrp && (
                    <span className="text-xs text-gray-500 line-through">
                      {set.msrp}
                    </span>
                  )}
                  <span className="text-green-400 font-semibold">{o.price}</span>
                </div>
              </a>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Links go through /out for tracking (beta).
          </p>
        </div>
      </section>
    </main>
  );
}