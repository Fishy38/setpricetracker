// app/api/refresh/lego/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePriceToCents } from "@/lib/utils";

const LEGO_RETAILER = "LEGO";

/**
 * Normalize stored LEGO URLs.
 * - If stored URL is a Rakuten LinkShare click url (linksynergy), extract `murl`.
 * - Return a direct lego.com URL string.
 */
function normalizeLegoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  try {
    const u = new URL(raw);

    // LinkShare click-tracker (Rakuten)
    if (u.hostname.includes("linksynergy.com")) {
      const murl = u.searchParams.get("murl");
      if (murl) {
        try {
          return decodeURIComponent(murl);
        } catch {
          return murl;
        }
      }
    }

    return raw;
  } catch {
    return raw ?? null;
  }
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const txt = m[1]?.trim();
    if (!txt) continue;
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return out;
}

// Flatten JSON-LD nodes, including @graph blocks
function flattenLd(nodes: any[]): any[] {
  const out: any[] = [];
  const stack = [...(nodes ?? [])];

  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;

    out.push(n);

    const g = n?.["@graph"];
    if (Array.isArray(g)) stack.push(...g);
  }

  return out;
}

function findOfferPrice(ld: any[]): { price: unknown; availability?: unknown } | null {
  const nodes = flattenLd(ld);

  for (const node of nodes) {
    const offers = node?.offers;

    const pick = (o: any) => {
      if (!o) return null;
      if (o?.price != null) return { price: o.price, availability: o.availability };
      if (o?.priceSpecification?.price != null) {
        return { price: o.priceSpecification.price, availability: o.availability };
      }
      return null;
    };

    if (Array.isArray(offers)) {
      for (const o of offers) {
        const hit = pick(o);
        if (hit) return hit;
      }
    } else if (offers) {
      const hit = pick(offers);
      if (hit) return hit;
    }

    if (node?.price != null) return { price: node.price, availability: node.availability };
    if (node?.priceSpecification?.price != null) {
      return { price: node.priceSpecification.price, availability: node.availability };
    }
  }

  return null;
}

function availabilityToInStock(v: unknown): boolean | null {
  if (v == null) return null;
  const s = String(v).toLowerCase();
  if (s.includes("instock")) return true;
  if (s.includes("outofstock")) return false;
  return null;
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const setId = searchParams.get("setId");

  if (!setId) {
    return NextResponse.json({ ok: false, error: "Missing setId" }, { status: 400 });
  }

  const set = await prisma.set.findUnique({ where: { setId } });

  if (!set?.legoUrl) {
    return NextResponse.json({ ok: false, error: "No legoUrl stored for this setId" }, { status: 400 });
  }

  const fetchUrl = normalizeLegoUrl(set.legoUrl);

  if (!fetchUrl) {
    return NextResponse.json({ ok: false, error: "Could not normalize legoUrl", legoUrl: set.legoUrl }, { status: 400 });
  }

  const res = await fetch(fetchUrl, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `LEGO fetch failed: ${res.status}`, legoUrl: fetchUrl }, { status: 502 });
  }

  const html = await res.text();
  const ld = extractJsonLd(html);
  const found = findOfferPrice(ld);

  const priceCents = parsePriceToCents(found?.price);
  const availability = availabilityToInStock(found?.availability);
  const inStock = availability ?? (priceCents != null ? true : null);

  await prisma.offer.upsert({
    where: { setIdRef_retailer: { setIdRef: setId, retailer: LEGO_RETAILER } },
    update: {
      price: priceCents,
      inStock,
      updatedAt: new Date(),
      // keep offer url as the canonical fetch url
      url: fetchUrl,
    },
    create: {
      setIdRef: setId,
      retailer: LEGO_RETAILER,
      url: fetchUrl,
      price: priceCents,
      inStock,
    },
  });

  const last = await prisma.priceHistory.findFirst({
    where: { setIdRef: setId, retailer: LEGO_RETAILER },
    orderBy: { recordedAt: "desc" },
  });

  const changed = last?.price !== priceCents || last?.inStock !== inStock;

  if (changed) {
    await prisma.priceHistory.create({
      data: {
        setIdRef: setId,
        retailer: LEGO_RETAILER,
        price: priceCents,
        inStock,
      },
    });
  }

  // Optional: normalize stored Set.legoUrl so future refreshes always hit lego.com directly
  try {
    if (set.legoUrl !== fetchUrl) {
      await prisma.set.update({
        where: { setId },
        data: { legoUrl: fetchUrl },
      });
    }
  } catch {
    // don't fail the refresh if this update fails
  }

  return NextResponse.json({
    ok: true,
    setId,
    legoUrl: fetchUrl,
    priceCents,
    inStock,
  });
}