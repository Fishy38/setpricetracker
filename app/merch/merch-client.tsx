// app/merch/merch-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { warmImageCache } from "@/lib/image-prefetch";
import { formatRetailerLabel } from "@/lib/retailer";
import { formatCentsUsd } from "@/lib/utils";

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

const PAGE_SIZE = 80;
const CACHE_TTL_MS = 5 * 60 * 1000;

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t?: number; data?: T } | null;
    if (!parsed || typeof parsed !== "object") return null;
    const ts = Number(parsed.t);
    if (!Number.isFinite(ts)) return null;
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch {
    // ignore cache write errors
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
  const pages: (number | "...")[] = [];

  const add = (v: number | "...") => pages.push(v);
  const start = Math.max(2, page - windowSize);
  const end = Math.min(pageCount - 1, page + windowSize);

  add(1);
  if (start > 2) add("...");
  for (let p = start; p <= end; p++) add(p);
  if (end < pageCount - 1) add("...");
  add(pageCount);

  return (
    <div className="w-full max-w-6xl mt-10 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(clampLocal(page - 1))}
        disabled={page <= 1}
        className="px-3 py-2 rounded-md border border-gray-700 bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-500 transition"
      >
        Prev
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="px-2 text-gray-500">
            ...
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
        className="px-3 py-2 rounded-md border border-gray-700 bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-500 transition"
      >
        Next
      </button>
    </div>
  );
}

export default function MerchClient() {
  const [items, setItems] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const cacheKey = "sets-cache:MERCH";
      const cached = readCache<ApiRow[]>(cacheKey);
      const cachedHasData = Array.isArray(cached) && cached.length > 0;

      if (cachedHasData) {
        setItems(cached as ApiRow[]);
        setLoading(false);
      }

      try {
        const res = await fetch("/api/sets?type=MERCH", { cache: "force-cache" });
        if (!res.ok) throw new Error("bad response");
        const data = (await res.json()) as ApiRow[];
        const next = Array.isArray(data) ? data : [];
        setItems(next);
        if (next.length) writeCache(cacheKey, next);
      } catch {
        if (!cachedHasData) setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil((items?.length ?? 0) / PAGE_SIZE));
  }, [items]);

  useEffect(() => {
    setPage((p) => clamp(p, 1, pageCount));
  }, [pageCount]);

  const pageList = useMemo(() => {
    const p = clamp(page, 1, pageCount);
    const start = (p - 1) * PAGE_SIZE;
    return (items ?? []).slice(start, start + PAGE_SIZE);
  }, [items, page, pageCount]);

  const nextPageList = useMemo(() => {
    if (pageCount <= 1) return [];
    const nextPage = clamp(page + 1, 1, pageCount);
    if (nextPage === page) return [];
    const start = (nextPage - 1) * PAGE_SIZE;
    return (items ?? []).slice(start, start + PAGE_SIZE);
  }, [items, page, pageCount]);

  useEffect(() => {
    if (loading) return;
    const urls = [...pageList, ...nextPageList].map((item) => item.imageUrl);
    warmImageCache(urls, { max: PAGE_SIZE, timeoutMs: 1200 });
  }, [loading, pageList, nextPageList]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-3">Merch</h1>
        <p className="text-gray-400 max-w-xl">
          Apparel, collectibles, accessories, storage, books, puzzles, and other non-set LEGO merch.
        </p>

        <div className="mt-4">
          <Link href="/" className="underline text-gray-300 hover:text-white">
            {"<- Back to sets"}
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </section>
      ) : items.length === 0 ? (
        <div className="text-gray-400">No merch found yet.</div>
      ) : (
        <>
          <section className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {pageList.map((it) => {
              const best = it.bestOffer ?? null;
              const price = best?.price ?? null;

              return (
                <Link key={it.setId} href={`/set/${it.setId}`} className="w-full">
                  <div className="border border-gray-800 rounded-md p-3 hover:border-gray-600 hover:bg-gray-900 transition cursor-pointer">
                    <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-800 mb-3 bg-gray-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.imageUrl}
                        alt={it.name ?? it.setId}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>

                    <div className="text-sm text-gray-300 mb-1 line-clamp-2">
                      {it.name ?? it.setId}
                    </div>
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

          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </main>
  );
}
