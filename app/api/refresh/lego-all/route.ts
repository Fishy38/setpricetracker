// app/api/refresh/lego-all/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { parsePriceToCents } from "@/lib/utils";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

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

function findOfferPrice(
  ld: any[]
): { price: unknown; availability?: unknown } | null {
  for (const node of ld) {
    const offers = node?.offers;

    if (Array.isArray(offers)) {
      for (const o of offers) {
        if (o?.price != null)
          return { price: o.price, availability: o.availability };
      }
    } else if (offers && offers?.price != null) {
      return { price: offers.price, availability: offers.availability };
    }

    if (node?.price != null)
      return { price: node.price, availability: node.availability };
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

async function refreshOne(setId: string) {
  // IMPORTANT: do NOT use a select that omits legoUrl
  const set = await prisma.set.findUnique({ where: { setId } });

  if (!set?.legoUrl) {
    return { setId, ok: false, error: "No legoUrl" as const };
  }

  const res = await fetch(set.legoUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      setId,
      ok: false,
      error: `LEGO fetch failed: ${res.status}` as const,
      legoUrl: set.legoUrl,
    };
  }

  const html = await res.text();
  const ld = extractJsonLd(html);
  const found = findOfferPrice(ld);

  const priceCents = parsePriceToCents(found?.price);
  const inStock = availabilityToInStock(found?.availability);

  // Update ONLY the LEGO offer row (URL should stay as your affiliate URL from seed)
  await prisma.offer.upsert({
    where: { setIdRef_retailer: { setIdRef: setId, retailer: "LEGO" } },
    update: {
      price: priceCents,
      inStock: inStock ?? true,
      updatedAt: new Date(),
    },
    create: {
      setIdRef: setId,
      retailer: "LEGO",
      url: set.legoUrl,
      price: priceCents,
      inStock: inStock ?? true,
    },
  });
  
  const last = await prisma.priceHistory.findFirst({
    where: { setIdRef: setId, retailer: "LEGO" },
    orderBy: { recordedAt: "desc" },
  });
  
  const changed = last?.price !== priceCents || last?.inStock !== inStock;
  
  if (changed) {
    await prisma.priceHistory.create({
      data: {
        setIdRef: setId,
        retailer: "LEGO",
        price: priceCents,
        inStock,
      },
    });
  }

  return {
    setId,
    ok: true,
    legoUrl: set.legoUrl,
    priceCents,
    inStock,
  };
}

// Simple concurrency limiter (so you don’t hammer LEGO)
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);

  // optional knobs:
  const limit = Math.max(1, Math.min(10, Number(searchParams.get("limit") ?? 2))); // concurrency (default 2)
  const take = Number(searchParams.get("take") ?? 0); // take first N sets (0 = all)

  const sets = await prisma.set.findMany({
    orderBy: { setId: "asc" },
    ...(take > 0 ? { take } : {}),
    select: { setId: true, legoUrl: true },
  });

  const setIds = sets
    .filter((s) => typeof s.legoUrl === "string" && s.legoUrl.length)
    .map((s) => s.setId);

  const results = await mapLimit(setIds, limit, refreshOne);

  const ok = results.filter((r: any) => r?.ok).length;
  const failed = results.length - ok;

  return NextResponse.json({
    ok: true,
    total: results.length,
    refreshed: ok,
    failed,
    results,
  });
}