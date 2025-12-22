// app/api/sets/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ShapedOffer = {
  retailer: string;
  price: number | null;
  url: string | null;
  inStock: boolean | null;
  updatedAt: Date | null;
};

function pickBestOffer(offers: ShapedOffer[]): ShapedOffer | null {
  if (!offers?.length) return null;

  // Prefer: has price + not explicitly out of stock
  const priced = offers.filter((o) => typeof o.price === "number" && o.price != null);

  const inStockPriced = priced.filter((o) => o.inStock !== false);
  const pool = inStockPriced.length ? inStockPriced : priced;

  if (!pool.length) return null;

  // lowest price wins, then newest updatedAt
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

// Anything matching these stays in MERCH.
// Everything else (that isn't explicitly typed) becomes SET by default.
const MERCH_KEYWORDS = [
  // Bags / apparel
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

  // Books / puzzles / media
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

  // Storage / home goods (these are NOT “sets” in your UI)
  "storage",
  "drawer",
  "box",
  "bin",
  "organizer",
  "luggage",

  // Accessories / home
  "key chain",
  "keychain",
  "lamp",
  "mug",
  "bottle",
  "tumbler",
];

function inferType(row: {
  setId: string;
  name?: string | null;
  productType?: string | null;
  setNumber?: string | null;
}) {
  const id = String(row.setId ?? "");
  const name = norm(row.name);
  const pt = norm(row.productType);
  const setNumber = norm(row.setNumber);

  // If DB has explicit classification, trust it
  if (pt === "set") return "SET";
  if (pt === "merch") return "MERCH";
  if (pt === "other") return "MERCH";

  // If setNumber exists and looks like a real LEGO set number, it's a set
  if (setNumber && isRealSetId(setNumber)) return "SET";

  // If setId itself is numeric, it's a set
  if (isRealSetId(id)) return "SET";

  // Merch overrides everything (bags/books/storage/etc)
  if (MERCH_KEYWORDS.some((k) => name.includes(k))) return "MERCH";

  // ✅ IMPORTANT CHANGE:
  // Default non-merch items to SET (because you said there are no real parts — everything else is sets)
  return "SET";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "").toUpperCase(); // "SET" | "MERCH"

  try {
    const rows = await prisma.set.findMany({
      orderBy: { setId: "asc" },
      select: {
        setId: true,
        name: true,
        imageUrl: true,
        msrp: true,
        productType: true,
        setNumber: true,
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
      const offers: ShapedOffer[] = (s.offers ?? []).map((o) => ({
        retailer: String(o.retailer ?? "Unknown"),
        price: typeof o.price === "number" ? o.price : null,
        url: o.url ?? null,
        inStock: o.inStock ?? null,
        updatedAt: (o.updatedAt as Date) ?? null,
      }));

      const bestOffer = pickBestOffer(offers);
      const { discountCents, discountPct } = computeDiscount(
        typeof s.msrp === "number" ? s.msrp : null,
        bestOffer?.price ?? null
      );

      const inferred = inferType({
        setId: String(s.setId),
        name: s.name ?? null,
        productType: (s as any).productType ?? null,
        setNumber: (s as any).setNumber ?? null,
      });

      return {
        setId: String(s.setId),
        name: s.name ?? null,
        imageUrl: String(s.imageUrl),
        msrp: typeof s.msrp === "number" ? s.msrp : null,
        offers,
        bestOffer,
        discountCents,
        discountPct,
        productType: (s as any).productType ?? null,
        setNumber: (s as any).setNumber ?? null,
        inferredType: inferred,
      };
    });

    if (type === "SET") {
      return NextResponse.json(shaped.filter((x) => x.inferredType === "SET"));
    }

    if (type === "MERCH") {
      return NextResponse.json(shaped.filter((x) => x.inferredType === "MERCH"));
    }

    // Backwards compat: if anything still calls PART/PARTS, treat as empty
    if (type === "PART" || type === "PARTS") {
      return NextResponse.json([]);
    }

    return NextResponse.json(shaped);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to load sets",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}