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
    } else {
      out.push({
        retailer: LEGO_RETAILER,
        price: rakuten.price ?? null,
        url: rakuten.url,
        inStock: rakuten.inStock ?? null,
        updatedAt: rakuten.updatedAt ?? null,
      });
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

function normalizeNameForMatch(input: string | null | undefined) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

const FORCE_SET_NAMES = [
  "Comic Book and Game Store",
  "T. rex River Escape",
  "Up-Scaled Racing Driver Minifigure",
  "Sherlock Holmes: Book Nook",
  "Captain America vs. Thanos",
  "Captain America: Civil War Action Battle",
  "Captain Toad's Camp",
  "Kai's Motorcycle Speed Race",
  "Ducati Panigale V4 S Motorcycle",
  "The Lord of the Rings: Balrog Book Nook",
  "Book Nook: Hogwarts Express",
  "Hagrid & Harry's Motorcycle Ride",
  "Police Motorcycle Chase",
  "Snack Shack",
  "Shadow the Hedgehog Escape",
  "Mack LR Electric Garbage Truck",
  "Captain Rex Y-Wing Microfighter",
  "Zoey's Cat Motorcycle",
].map((n) => normalizeNameForMatch(n));

const FORCE_MERCH_NAMES = ["sword", "swords", "salt and pepper", "salt and pepper shaker"].map(
  (n) => normalizeNameForMatch(n)
);

const CLOTHING_KEYWORDS = [
  "t shirt",
  "tee",
  "hoodie",
  "sweatshirt",
  "sweater",
  "jacket",
  "coat",
  "pants",
  "shorts",
  "leggings",
  "pajama",
  "sleepwear",
  "shirt",
  "jersey",
  "hat",
  "cap",
  "beanie",
  "scarf",
  "gloves",
  "socks",
];

const SIZE_TOKENS = new Set([
  "xxs",
  "xs",
  "s",
  "sm",
  "small",
  "medium",
  "med",
  "m",
  "large",
  "lg",
  "xl",
  "xxl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "youth",
  "adult",
  "mens",
  "men",
  "womens",
  "women",
  "kids",
  "kid",
  "child",
  "children",
  "boys",
  "girls",
  "unisex",
]);

function shouldForceSet(name: string | null | undefined) {
  const n = normalizeNameForMatch(name);
  if (!n) return false;
  return FORCE_SET_NAMES.some((k) => n.includes(k));
}

function shouldForceMerch(name: string | null | undefined) {
  const n = normalizeNameForMatch(name);
  if (!n) return false;
  return FORCE_MERCH_NAMES.some((k) => n.includes(k));
}

function isClothingName(normalizedName: string) {
  return CLOTHING_KEYWORDS.some((k) => normalizedName.includes(k));
}

function clothingKey(name: string | null | undefined) {
  const n = normalizeNameForMatch(name);
  if (!n) return "";
  const parts = n.split(" ").filter(Boolean);
  const filtered = parts.filter((p) => !SIZE_TOKENS.has(p));
  return filtered.join(" ");
}

function merchScore(row: any) {
  let score = 0;
  if (row?.bestOffer?.url) score += 4;
  if (row?.bestOffer?.price != null) score += 2;
  if (row?.bestOffer?.inStock !== false) score += 1;
  if (row?.imageUrl) score += 1;
  return score;
}

function dedupeMerchClothing(rows: any[]) {
  const out: any[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows ?? []) {
    const normalized = normalizeNameForMatch(row?.name);
    if (!normalized || !isClothingName(normalized)) {
      out.push(row);
      continue;
    }

    const key = clothingKey(row?.name);
    if (!key) {
      out.push(row);
      continue;
    }

    const existingIndex = indexByKey.get(key);
    if (existingIndex == null) {
      indexByKey.set(key, out.length);
      out.push(row);
      continue;
    }

    const existing = out[existingIndex];
    if (merchScore(row) > merchScore(existing)) {
      out[existingIndex] = row;
    }
  }

  return out;
}

// IMPORTANT: since you said “parts is gone”, we only classify SET vs MERCH now.
function inferType(row: { setId: string; name?: string | null }) {
  const id = String(row.setId ?? "").trim();
  const name = norm(row.name);

  if (shouldForceSet(row.name)) return "SET";
  if (shouldForceMerch(row.name)) return "MERCH";

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
    if (type === "MERCH") {
      const merch = shaped.filter((x) => x.inferredType === "MERCH");
      return NextResponse.json(dedupeMerchClothing(merch));
    }

    return NextResponse.json(shaped);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load sets", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
