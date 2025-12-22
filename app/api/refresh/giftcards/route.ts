// app/api/refresh/giftcards/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllGiftcardProducts, extractMurl } from "@/lib/rakuten";
import { parsePriceToCents } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------- Auth (for Vercel Cron + manual curl) ----------
function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function requireCronKey(req: Request) {
  // If CRON_SECRET is not set, we allow (local dev convenience).
  const expected = process.env.CRON_SECRET;
  if (!expected) return;

  const provided =
    req.headers.get("x-cron-key") ||
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (provided !== expected) throw new Error("UNAUTHORIZED");
}

// ---------- Helpers ----------
function asFirstString(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  return String(v);
}

function getProductId(item: any): string | null {
  return (
    asFirstString(item?.productid) ??
    asFirstString(item?.catalogid) ??
    asFirstString(item?.sku) ??
    null
  );
}

function getName(item: any): string {
  return asFirstString(item?.productname)?.trim() || "Gift Card";
}

function getBrand(item: any): string | null {
  return asFirstString(item?.brand)?.trim() ?? null;
}

function getImageUrl(item: any): string | null {
  return asFirstString(item?.imageurl)?.trim() ?? null;
}

function getAffiliateUrl(item: any): string | null {
  return asFirstString(item?.linkurl)?.trim() ?? null;
}

function getRawPrice(item: any): string | null {
  const p0 = item?.price?.[0];
  const p = p0?._ ?? p0 ?? item?.price?._ ?? item?.price ?? null;
  return p == null ? null : String(p).trim();
}

/**
 * Extra safety filter (even if Rakuten keyword search is used)
 * We check multiple fields because Rakuten fields vary.
 */
function isLegoGiftCard(item: any): boolean {
  const name = (asFirstString(item?.productname) ?? "").toLowerCase();
  const brand = (asFirstString(item?.brand) ?? "").toLowerCase();
  const link = (asFirstString(item?.linkurl) ?? "").toLowerCase();
  const img = (asFirstString(item?.imageurl) ?? "").toLowerCase();

  if (name.includes("lego")) return true;
  if (brand.includes("lego")) return true;
  if (link.includes("lego")) return true;
  if (img.includes("lego")) return true;

  return false;
}

// ---------- Route ----------
export async function POST(req: Request) {
  try {
    requireCronKey(req);
  } catch (e: any) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return new NextResponse(`Auth error: ${e?.message ?? String(e)}`, {
      status: 500,
    });
  }

  const { searchParams } = new URL(req.url);

  // knobs
  const keyword = (searchParams.get("keyword") ?? "lego").trim();
  const purge = searchParams.get("purge") === "1"; // purge old rows for this advertiser first
  const dryRun = searchParams.get("dry") === "1"; // don't write anything

  const advertiserId = process.env.RAKUTEN_GIFTCARD_MID ?? null;

  let products: any[] = [];
  try {
    // Source-side filtering (best)
    products = await fetchAllGiftcardProducts(keyword);

    // Optional fallback for case quirks
    if (!products?.length && keyword.toLowerCase() === "lego") {
      products = await fetchAllGiftcardProducts("LEGO");
    }
  } catch (e: any) {
    return new NextResponse(
      `Rakuten fetchAllGiftcardProducts("${keyword}") failed:\n${e?.message ?? String(e)}`,
      { status: 500 }
    );
  }

  // Optional: purge old rows for this advertiser (safe reset)
  if (purge && !dryRun) {
    try {
      await prisma.giftCardOffer.deleteMany({
        where: advertiserId ? { advertiserId } : {},
      });
    } catch (err: any) {
      if (err?.code === "P2021") {
        return new NextResponse(
          "GiftCardOffer table is missing (P2021). Run Prisma migrate/push on the DATABASE_URL used in this environment.",
          { status: 500 }
        );
      }
      throw err;
    }
  }

  let fetched = products?.length ?? 0;
  let matched = 0;
  let upserted = 0;
  let skipped = 0;
  let missingId = 0;

  // Useful debug: show a few examples
  const sampleMatchedIds: string[] = [];
  const sampleSkippedIds: string[] = [];

  for (const item of products ?? []) {
    if (!isLegoGiftCard(item)) {
      skipped++;
      const pid = getProductId(item);
      if (pid && sampleSkippedIds.length < 5) sampleSkippedIds.push(String(pid));
      continue;
    }
    matched++;

    const rakutenProductId = getProductId(item);
    if (!rakutenProductId) {
      missingId++;
      continue;
    }

    const name = getName(item);
    const brand = getBrand(item);
    const imageUrl = getImageUrl(item);

    const affiliateUrl = getAffiliateUrl(item);
    const destinationUrl = extractMurl(affiliateUrl);
    const canonicalUrl = destinationUrl ?? affiliateUrl ?? null;

    const priceCents = parsePriceToCents(getRawPrice(item));

    if (dryRun) {
      if (sampleMatchedIds.length < 10) sampleMatchedIds.push(String(rakutenProductId));
      continue;
    }

    try {
      await prisma.giftCardOffer.upsert({
        where: { rakutenProductId: String(rakutenProductId) },
        update: {
          name,
          brand,
          imageUrl,
          affiliateUrl,
          destinationUrl,
          canonicalUrl,
          price: priceCents,
          advertiserId,
          lastSyncedAt: new Date(),
        },
        create: {
          rakutenProductId: String(rakutenProductId),
          name,
          brand,
          imageUrl,
          affiliateUrl,
          destinationUrl,
          canonicalUrl,
          price: priceCents,
          advertiserId,
          lastSyncedAt: new Date(),
        },
      });

      upserted++;
      if (sampleMatchedIds.length < 10) sampleMatchedIds.push(String(rakutenProductId));
    } catch (err: any) {
      if (err?.code === "P2021") {
        return new NextResponse(
          "GiftCardOffer table is missing (P2021). Run Prisma migrate/push on the DATABASE_URL used in this environment.",
          { status: 500 }
        );
      }
      throw err;
    }
  }

  console.log(
    `🎁 Giftcards refresh keyword="${keyword}" fetched=${fetched} matched=${matched} upserted=${upserted} skipped=${skipped} missingId=${missingId} purge=${purge} dryRun=${dryRun}`
  );

  return NextResponse.json({
    ok: true,
    keyword,
    purge,
    dryRun,
    fetched,
    matched,
    upserted,
    skipped,
    missingId,
    sampleMatchedIds,
    sampleSkippedIds,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
