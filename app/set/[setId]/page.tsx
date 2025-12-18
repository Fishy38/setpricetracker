"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SETS } from "../../../lib/sets";

export default function SetPage() {
  const params = useParams();
  const setId = params?.setId as string | undefined;

  const set = SETS.find((s) => s.setId === setId);

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
        {/* Left: big image */}
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

        {/* Right: retailer list */}
        <div className="border border-gray-800 rounded-md p-4">
          <h2 className="text-xl font-semibold mb-3">Retailers</h2>

          <div className="space-y-3">
            {set.offers.map((o, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center border border-gray-800 rounded-md px-4 py-3"
              >
                <span className="font-medium">{o.retailer}</span>

                <div className="flex items-center gap-3">
                  {set.msrp && (
                    <span className="text-xs text-gray-500 line-through">
                      {set.msrp}
                    </span>
                  )}
                  <span className="text-green-400 font-semibold">{o.price}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Prices shown are placeholders until we wire real data.
          </p>
        </div>
      </section>
    </main>
  );
}