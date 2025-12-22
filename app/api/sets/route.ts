// app/api/sets/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RAKUTEN_LEGO_RETAILER } from "@/lib/retailer";

type ShapedOffer = {
  retailer: string;
  price: number | null;
  url: string | null;
  inStock: boolean | null;
  updatedAt: Date | null;
};

const LEGO_RETAILER = "LEGO";

function mergeRakutenLegoOffer(offers: ShapedOffer[]): ShapedOffer[] {
  let rakuten: ShapedOffer | null = null;
  const out: ShapedOffer[] = [];

  for (const o of offers ?? []) {
    const key = String(o.retailer ?? "").trim().toUpperCase();
    if (key === RAKUTEN_LEGO_RETAILER) {
      rakuten = o;
      continue;
    }
    out.push(o);
  }

  if (rakuten?.url) {
    const legoIdx = out.findIndex(
      (o) => String(o.retailer ?? "").trim().toUpperCase() === LEGO_RETAILER
    );
    if (legoIdx >= 0) {
      out[legoIdx] = { ...out[legoIdx], url: rakuten.url };
    }
  }

  return out;
}

function pickBestOffer(offers: ShapedOffer[]): ShapedOffer | null {
  if (!offers?.length) return null;

  const priced = offers.filter((o) => typeof o.price === "number" && o.price != null);
  const inStockPriced = priced.filter((o) => o.inStock !== false);
  const pool = inStockPriced.length ? inStockPriced : priced;

  if (!pool.length) return null;

  pool.sort((a, b) => {
    const ap = a.price ?? Number.POSITIVE_INFINITY;
    const bp = b.price ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;

    const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bt - at;
  });

  return pool[0] ?? null;
}

function computeDiscount(msrp: number | null, bestPrice: number | null) {
  if (msrp == null || bestPrice == null) return { discountCents: null, discountPct: null };
  if (msrp <= 0) return { discountCents: null, discountPct: null };

  const discountCents = msrp - bestPrice;
  if (discountCents <= 0) return { discountCents: null, discountPct: null };

  const discountPct = Math.round((discountCents / msrp) * 100);
  return { discountCents, discountPct };
}

function isRealSetId(setId: string) {
  const id = String(setId ?? "").trim();
  return /^[0-9]+$/.test(id) && id.length >= 4 && id.length <= 6;
}

function norm(s: string | null | undefined) {
  return String(s ?? "").trim().toLowerCase();
}

// Merch keywords (what should NOT be on the main set page)
const MERCH_KEYWORDS = [
  "backpack",
  "bag",
  "lunch bag",
  "lunch box",
  "hip pack",
  "pouch",
  "crossbody",
  "fanny",
  "waist",
  "tote",
  "wallet",
  "hat",
  "cap",
  "beanie",
  "shirt",
  "t-shirt",
  "hoodie",
  "jacket",
  "sweater",
  "jersey",
  "pants",
  "shorts",
  "socks",
  "book",
  "books",
  "puzzle",
  "puzzles",
  "magazine",
  "poster",
  "calendar",
  "comic",
  "journal",
  "notebook",
  "storage",
  "drawer",
  "box",
  "bin",
  "organizer",
  "luggage",
  "key chain",
  "keychain",
  "lamp",
  "mug",
  "bottle",
  "tumbler",
];

// IMPORTANT: since you said “parts is gone”, we only classify SET vs MERCH now.
function inferType(row: { setId: string; name?: string | null }) {
  const id = String(row.setId ?? "").trim();
  const name = norm(row.name);

  // Real LEGO set numbers / numeric IDs: treat as SET
  if (isRealSetId(id)) return "SET";

  // Everything else: merch
  // (We still keep keywords here in case you later want to split merch categories)
  if (MERCH_KEYWORDS.some((k) => name.includes(k))) return "MERCH";

  return "MERCH";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "").toUpperCase(); // "SET" | "MERCH" | etc.

  try {
    const rows = await prisma.set.findMany({
      orderBy: { setId: "asc" },
      select: {
        setId: true,
        name: true,
        imageUrl: true,
        msrp: true,
        offers: {
          select: {
            retailer: true,
            price: true,
            url: true,
            inStock: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    const shaped = rows.map((s) => {
      const offersRaw: ShapedOffer[] = (s.offers ?? []).map((o) => ({
        retailer: String(o.retailer ?? "Unknown"),
        price: typeof o.price === "number" ? o.price : null,
        url: o.url ?? null,
        inStock: o.inStock ?? null,
        updatedAt: (o.updatedAt as Date) ?? null,
      }));

      const offers = mergeRakutenLegoOffer(offersRaw);

      const bestOffer = pickBestOffer(offers);
      const { discountCents, discountPct } = computeDiscount(
        typeof s.msrp === "number" ? s.msrp : null,
        bestOffer?.price ?? null
      );

      const inferredType = inferType({ setId: String(s.setId), name: s.name ?? null });

      return {
        setId: String(s.setId),
        name: s.name ?? null,
        imageUrl: String(s.imageUrl),
        msrp: typeof s.msrp === "number" ? s.msrp : null,
        offers,
        bestOffer,
        discountCents,
        discountPct,
        inferredType,
      };
    });

    if (type === "SET") return NextResponse.json(shaped.filter((x) => x.inferredType === "SET"));
    if (type === "MERCH") return NextResponse.json(shaped.filter((x) => x.inferredType === "MERCH"));

    return NextResponse.json(shaped);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load sets", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
