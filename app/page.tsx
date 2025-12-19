// app/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SETS as FALLBACK_SETS } from "../lib/sets";

type ApiOffer = {
  retailer: string;
  price: number | null; // cents
  url?: string | null;
  inStock?: boolean | null;
  updatedAt?: string | Date;
};

type ApiSetRow = {
  setId: string;
  name?: string | null;
  imageUrl: string;
  msrp?: number | null; // cents
  bestOffer?: ApiOffer | null; // ✅ NEW
  offers: ApiOffer[];
};

type UiOffer = {
  retailer: string;
  priceCents: number | null;
};

type UiSetRow = {
  setId: string;
  imageUrl: string;
  msrpCents: number | null;
  bestOffer: UiOffer | null; // ✅ NEW
};

function money(cents?: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function parseToCents(v: unknown): number | null {
  if (v == null) return null;

  if (typeof v === "number") {
    if (Number.isInteger(v)) return v; // assume cents
    return Math.round(v * 100); // dollars -> cents
  }

  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (Number.isNaN(n)) return null;
    if (cleaned.includes(".") || n < 1000) return Math.round(n * 100); // dollars-ish
    return Math.round(n); // cents-ish
  }

  return null;
}

function normalizeSets(input: any[]): UiSetRow[] {
  return (input ?? []).map((s) => {
    const msrpCents = parseToCents(s.msrp);

    const bo =
      s.bestOffer ??
      (s.offers ?? []).find((o: any) => o?.price != null) ??
      (s.offers ?? [])[0] ??
      null;

    const bestOffer: UiOffer | null = bo
      ? {
          retailer: String(bo.retailer ?? "Unknown"),
          priceCents: parseToCents(bo.price),
        }
      : null;

    return {
      setId: String(s.setId),
      imageUrl: String(s.imageUrl),
      msrpCents,
      bestOffer,
    };
  });
}

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const [sets, setSets] = useState<UiSetRow[]>(
    normalizeSets(FALLBACK_SETS as any)
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sets", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ApiSetRow[];
        if (Array.isArray(data) && data.length) setSets(normalizeSets(data as any));
      } catch {
        // keep fallback
      }
    })();
  }, []);

  const setList = useMemo(() => sets, [sets]);

  function go() {
    const id = q.trim();
    if (!id) return;
    router.push(`/set/${id}`);
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-3">SetPriceTracker</h1>
        <p className="text-gray-400 max-w-xl">
          Track LEGO set prices across major retailers and find the best deal.
        </p>
      </header>

      <section className="w-full max-w-xl mb-10">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            type="text"
            placeholder="Enter LEGO set number (e.g. 75394)"
            className="
              flex-1 rounded-md px-4 py-3
              bg-gray-900 text-white placeholder-gray-400
              border border-gray-700
              focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400
            "
          />
          <button
            onClick={go}
            className="
              px-4 py-3 rounded-md
              bg-green-400 text-black font-semibold
              hover:bg-green-300 transition
            "
          >
            Go
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl grid grid-cols-4 gap-4">
        {setList.map((set) => (
          <PriceCard
            key={set.setId}
            setId={set.setId}
            imageUrl={set.imageUrl}
            store={set.bestOffer?.retailer ?? "Unknown"}
            priceCents={set.bestOffer?.priceCents ?? null}
            msrpCents={set.msrpCents}
          />
        ))}
      </section>

      <footer className="mt-16 text-sm text-gray-500 text-center">
        <p className="mb-2">As an Amazon Associate, we earn from qualifying purchases.</p>
        <p>© {new Date().getFullYear()} SetPriceTracker</p>
      </footer>
    </main>
  );
}

function PriceCard({
  setId,
  imageUrl,
  store,
  priceCents,
  msrpCents,
}: {
  setId: string;
  imageUrl: string;
  store: string;
  priceCents: number | null;
  msrpCents: number | null;
}) {
  return (
    <Link href={`/set/${setId}`} className="w-full">
      <div className="border border-gray-800 rounded-md p-3 hover:border-gray-600 hover:bg-gray-900 transition cursor-pointer">
        <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-800 mb-3 bg-black">
          <img src={imageUrl} alt={`LEGO set ${setId}`} className="w-full h-full object-cover" />
        </div>

        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Set</span>
          <span className="text-gray-300 font-semibold">{setId}</span>
        </div>

        <div className="font-medium mb-1">{store}</div>

        <div className="flex items-end gap-2">
          {msrpCents != null && (
            <span className="text-xs text-gray-500 line-through">{money(msrpCents)}</span>
          )}
          <span className="text-green-400 font-semibold">{money(priceCents)}</span>
        </div>
      </div>
    </Link>
  );
}