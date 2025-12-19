// app/page.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  offers: ApiOffer[];
  bestOffer?: ApiOffer | null;

  discountCents?: number | null;
  discountPct?: number | null;
};

type UiOffer = {
  retailer: string;
  priceCents: number | null;
};

type UiSetRow = {
  setId: string;
  name?: string | null;
  imageUrl: string;
  msrpCents: number | null;
  bestOffer: UiOffer | null;
  discountCents: number | null;
  discountPct: number | null;
};

type SortKey = "biggestDiscount" | "lowestPrice" | "highestPrice" | "setId";

const PAGE_SIZE = 80 as const;
const DEFAULT_SORT: SortKey = "biggestDiscount";

function money(cents?: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function parseToCents(v: unknown): number | null {
  if (v == null) return null;

  if (typeof v === "number") {
    if (Number.isInteger(v)) return v; // cents
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
      name: s.name != null ? String(s.name) : null,
      imageUrl: String(s.imageUrl),
      msrpCents,
      bestOffer,
      discountCents:
        typeof s.discountCents === "number" ? s.discountCents : null,
      discountPct: typeof s.discountPct === "number" ? s.discountPct : null,
    };
  });
}

function SkeletonCard() {
  return (
    <div className="border border-gray-800 rounded-md p-3 animate-pulse">
      <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-800 mb-3 bg-gray-900" />
      <div className="h-3 w-20 bg-gray-900 rounded mb-2" />
      <div className="h-4 w-28 bg-gray-900 rounded mb-2" />
      <div className="h-4 w-16 bg-gray-900 rounded" />
    </div>
  );
}

function sortSets(list: UiSetRow[], sortKey: SortKey): UiSetRow[] {
  const out = [...(list ?? [])];

  const price = (s: UiSetRow) => s.bestOffer?.priceCents ?? null;
  const pct = (s: UiSetRow) => s.discountPct ?? null;

  out.sort((a, b) => {
    const tie = () => String(a.setId).localeCompare(String(b.setId));

    if (sortKey === "setId") return tie();

    if (sortKey === "biggestDiscount") {
      const ap = pct(a);
      const bp = pct(b);
      if (ap == null && bp == null) return tie();
      if (ap == null) return 1;
      if (bp == null) return -1;
      return bp - ap || tie(); // biggest first
    }

    if (sortKey === "lowestPrice") {
      const ap = price(a);
      const bp = price(b);
      if (ap == null && bp == null) return tie();
      if (ap == null) return 1;
      if (bp == null) return -1;
      return ap - bp || tie();
    }

    if (sortKey === "highestPrice") {
      const ap = price(a);
      const bp = price(b);
      if (ap == null && bp == null) return tie();
      if (ap == null) return 1;
      if (bp == null) return -1;
      return bp - ap || tie();
    }

    return tie();
  });

  return out;
}

function isNumericQuery(s: string) {
  const t = s.trim();
  return t.length > 0 && /^[0-9]+$/.test(t);
}

function matchesQuery(set: UiSetRow, rawQuery: string) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const id = String(set.setId).toLowerCase();
  const name = String(set.name ?? "").toLowerCase();

  return id.includes(q) || name.includes(q);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function coerceSort(v: string | null): SortKey {
  if (v === "biggestDiscount") return "biggestDiscount";
  if (v === "lowestPrice") return "lowestPrice";
  if (v === "highestPrice") return "highestPrice";
  if (v === "setId") return "setId";
  return DEFAULT_SORT;
}

function coercePage(v: string | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export default function Home() {
  const router = useRouter();
  const sp = useSearchParams();

  // URL-driven state
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<UiSetRow[]>([]);

  // prevent URL sync loops
  const didInitFromUrl = useRef(false);

  // 1) Init state from URL (and whenever URL changes via back/forward)
  useEffect(() => {
    const urlQ = sp.get("q") ?? "";
    const urlSort = coerceSort(sp.get("sort"));
    const urlPage = coercePage(sp.get("page"));

    // on first mount, always hydrate from URL
    if (!didInitFromUrl.current) {
      didInitFromUrl.current = true;
      setQ(urlQ);
      setSortKey(urlSort);
      setPage(urlPage);
      return;
    }

    // on back/forward, update if differs
    setQ((prev) => (prev !== urlQ ? urlQ : prev));
    setSortKey((prev) => (prev !== urlSort ? urlSort : prev));
    setPage((prev) => (prev !== urlPage ? urlPage : prev));
  }, [sp]);

  // 2) Fetch sets
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sets", { cache: "no-store" });
        if (!res.ok) throw new Error("bad response");
        const data = (await res.json()) as ApiSetRow[];
        if (Array.isArray(data) && data.length) {
          setSets(normalizeSets(data as any));
        } else {
          setSets(normalizeSets(FALLBACK_SETS as any));
        }
      } catch {
        setSets(normalizeSets(FALLBACK_SETS as any));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 3) Derived list + pageCount
  const filteredSortedList = useMemo(() => {
    const filtered = (sets ?? []).filter((s) => matchesQuery(s, q));
    return sortSets(filtered, sortKey);
  }, [sets, q, sortKey]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredSortedList.length / PAGE_SIZE));
  }, [filteredSortedList.length]);

  // Keep page in range when data/search changes
  useEffect(() => {
    setPage((p) => clamp(p, 1, pageCount));
  }, [pageCount]);

  const pageList = useMemo(() => {
    const p = clamp(page, 1, pageCount);
    const start = (p - 1) * PAGE_SIZE;
    return filteredSortedList.slice(start, start + PAGE_SIZE);
  }, [filteredSortedList, page, pageCount]);

  // 4) Sync state -> URL (replaceState so it’s not spammy)
  useEffect(() => {
    if (!didInitFromUrl.current) return;

    const params = new URLSearchParams();
    const tq = q.trim();

    if (tq) params.set("q", tq);
    if (sortKey !== DEFAULT_SORT) params.set("sort", sortKey);
    if (page > 1) params.set("page", String(page));

    const qs = params.toString();
    const next = qs ? `/?${qs}` : "/";
    router.replace(next);
  }, [q, sortKey, page, router]);

  function go() {
    const raw = q.trim();
    if (!raw) return;

    if (isNumericQuery(raw)) {
      router.push(`/set/${raw}`);
      return;
    }

    // names: do NOT navigate; just filter the grid
  }

  function onChangeSort(next: SortKey) {
    setSortKey(next);
    setPage(1);
  }

  function onChangeQuery(next: string) {
    setQ(next);
    setPage(1);
  }

  function onChangePage(next: number) {
    setPage(clamp(next, 1, pageCount));
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-3">SetPriceTracker</h1>
        <p className="text-gray-400 max-w-xl">
          Track LEGO set prices across major retailers and find the best deal.
        </p>
      </header>

      <section className="w-full max-w-6xl mb-6 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="w-full md:max-w-xl">
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => onChangeQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && go()}
                type="text"
                placeholder="Search by set # or name (e.g. 75394 or flower)"
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

            {!loading && q.trim() && !isNumericQuery(q) && (
              <div className="mt-2 text-xs text-gray-500">
                Showing {filteredSortedList.length} match
                {filteredSortedList.length === 1 ? "" : "es"} for “{q.trim()}”
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Sort
            </span>
            <select
              value={sortKey}
              onChange={(e) => onChangeSort(e.target.value as SortKey)}
              className="
                rounded-md px-3 py-2
                bg-gray-900 text-white
                border border-gray-700
                focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400
              "
            >
              <option value="biggestDiscount">Biggest discount %</option>
              <option value="lowestPrice">Lowest price</option>
              <option value="highestPrice">Highest price</option>
              <option value="setId">Set #</option>
            </select>
          </div>
        </div>
      </section>

      <section className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          pageList.map((set) => (
            <PriceCard
              key={set.setId}
              setId={set.setId}
              imageUrl={set.imageUrl}
              name={set.name}
              store={set.bestOffer?.retailer ?? "Unknown"}
              priceCents={set.bestOffer?.priceCents ?? null}
              msrpCents={set.msrpCents}
              discountPct={set.discountPct}
            />
          ))
        )}
      </section>

      {!loading && (
        <div className="w-full max-w-6xl mt-8 flex items-center justify-between text-xs text-gray-500">
          <div>
            Page {page} of {pageCount} • Showing{" "}
            {pageList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {(page - 1) * PAGE_SIZE + pageList.length} of{" "}
            {filteredSortedList.length}
          </div>

          <div className="text-gray-600">Page size: {PAGE_SIZE}</div>
        </div>
      )}

      {!loading && (
        <Pagination page={page} pageCount={pageCount} onPageChange={onChangePage} />
      )}

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
  name,
  store,
  priceCents,
  msrpCents,
  discountPct,
}: {
  setId: string;
  imageUrl: string;
  name?: string | null;
  store: string;
  priceCents: number | null;
  msrpCents: number | null;
  discountPct: number | null;
}) {
  const showMsrpLine =
    msrpCents != null && priceCents != null && priceCents < msrpCents;

  const showDiscountBadge =
    showMsrpLine && discountPct != null && discountPct > 0;

  return (
    <Link href={`/set/${setId}`} className="w-full">
      <div className="border border-gray-800 rounded-md p-3 hover:border-gray-600 hover:bg-gray-900 transition cursor-pointer">
        <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-800 mb-3 bg-black relative">
          <img
            src={imageUrl}
            alt={`LEGO set ${setId}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {showDiscountBadge && (
            <div className="absolute top-2 left-2 text-xs font-semibold bg-green-400 text-black px-2 py-1 rounded-md">
              -{discountPct}%
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">
            Set
          </span>
          <span className="text-gray-300 font-semibold">{setId}</span>
        </div>

        {name ? (
          <div className="text-sm text-gray-300 mb-1 line-clamp-2">{name}</div>
        ) : (
          <div className="font-medium mb-1">{store}</div>
        )}

        {name && <div className="text-sm text-gray-400 mb-1">{store}</div>}

        <div className="flex items-end gap-2">
          {showMsrpLine && (
            <span className="text-xs text-gray-500 line-through">
              {money(msrpCents)}
            </span>
          )}
          <span className="text-green-400 font-semibold">
            {money(priceCents)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;

  const clampLocal = (p: number) => Math.min(pageCount, Math.max(1, p));

  const windowSize = 2;
  const pages: (number | "…")[] = [];

  const add = (v: number | "…") => pages.push(v);

  const start = Math.max(2, page - windowSize);
  const end = Math.min(pageCount - 1, page + windowSize);

  add(1);
  if (start > 2) add("…");
  for (let p = start; p <= end; p++) add(p);
  if (end < pageCount - 1) add("…");
  add(pageCount);

  return (
    <div className="w-full max-w-6xl mt-10 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(clampLocal(page - 1))}
        disabled={page <= 1}
        className="
          px-3 py-2 rounded-md border border-gray-700 bg-gray-900
          disabled:opacity-40 disabled:cursor-not-allowed
          hover:border-gray-500 transition
        "
      >
        Prev
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="px-2 text-gray-500">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={
              p === page
                ? "px-3 py-2 rounded-md bg-green-400 text-black font-semibold"
                : "px-3 py-2 rounded-md border border-gray-700 bg-gray-900 hover:border-gray-500 transition"
            }
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(clampLocal(page + 1))}
        disabled={page >= pageCount}
        className="
          px-3 py-2 rounded-md border border-gray-700 bg-gray-900
          disabled:opacity-40 disabled:cursor-not-allowed
          hover:border-gray-500 transition
        "
      >
        Next
      </button>
    </div>
  );
}