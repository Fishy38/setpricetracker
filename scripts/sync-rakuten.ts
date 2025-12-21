// scripts/sync-rakuten.ts
import "dotenv/config";
import { fetchAllLegoProducts } from "@/lib/rakuten";
import { parsePriceToCents } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { isBuildableLegoSet } from "@/lib/rakuten/shouldIncludeProduct";

/**
 * Trigger LEGO scrape refresh after Rakuten sync finishes.
 * This hits your running Next server:
 * - dev: http://localhost:3000
 * - prod: NEXT_PUBLIC_SITE_URL / SITE_URL / VERCEL_URL
 *
 * If the server isn't running (ECONNREFUSED), we skip without failing the sync.
 */
async function triggerLegoRefreshAfterSync() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL
      ? process.env.VERCEL_URL.startsWith("http")
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const url = new URL("/api/refresh/lego-all", base);

  // Optional knobs
  url.searchParams.set("limit", "2"); // concurrency
  // url.searchParams.set("take", "200"); // only first N sets

  console.log(`🔁 Triggering LEGO refresh: ${url.toString()}`);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`LEGO refresh failed: ${res.status} ${txt}`);
    }

    const data = await res.json().catch(() => ({}));
    console.log("✅ LEGO refresh finished:", {
      total: data?.total,
      refreshed: data?.refreshed,
      failed: data?.failed,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? err);

    // If your Next server isn't running locally, don't fail the whole sync.
    // (Common when you run the script standalone.)
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("Failed to fetch")
    ) {
      console.warn("⚠️ Skipping LEGO refresh (server not reachable):", msg);
      return;
    }

    throw err;
  }
}

type Args = {
  limit?: number;
  dryRun: boolean;
  verbose: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { dryRun: false, verbose: false };

  for (const a of args) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--verbose") out.verbose = true;
    else if (a.startsWith("--limit=")) {
      const n = Number(a.split("=")[1]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --limit value: ${a}`);
      out.limit = n;
    }
  }

  return out;
}

function asFirstString(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  return String(v);
}

/**
 * Rakuten linkurl is often an affiliate wrapper containing ?murl=<real lego url>.
 * We want the real lego.com URL for scraping.
 */
function extractMurl(affiliateUrl: string): string | null {
  try {
    const u = new URL(affiliateUrl);
    const murl = u.searchParams.get("murl");
    if (!murl) return null;
    return decodeURIComponent(murl);
  } catch {
    return null;
  }
}

function isProbablyLegoSetNumber(id: string): boolean {
  const s = id.trim();
  if (!/^\d{4,6}$/.test(s)) return false;
  if (s.startsWith("500")) return false;
  if (s.startsWith("2000")) return false;
  return true;
}

function extractSetNumberFromLegoUrl(legoUrl: string | null): string | null {
  if (!legoUrl) return null;
  const raw = extractMurl(legoUrl) ?? legoUrl;

  try {
    const u = new URL(raw);
    const path = u.pathname;

    const m1 = path.match(/-([0-9]{4,6})\/?$/);
    if (m1?.[1] && isProbablyLegoSetNumber(m1[1])) return m1[1];

    const m2 = path.match(/\/([0-9]{4,6})\/?$/);
    if (m2?.[1] && isProbablyLegoSetNumber(m2[1])) return m2[1];

    const m3 = raw.match(/\b([0-9]{4,6})\b/);
    if (m3?.[1] && isProbablyLegoSetNumber(m3[1])) return m3[1];

    return null;
  } catch {
    const m = raw.match(/\b([0-9]{4,6})\b/);
    if (m?.[1] && isProbablyLegoSetNumber(m[1])) return m[1];
    return null;
  }
}

function extractSetNumberFromName(name: string | null): string | null {
  if (!name) return null;
  const m = name.match(/\b(\d{4,6})\b/);
  if (m?.[1] && isProbablyLegoSetNumber(m[1])) return m[1];
  return null;
}

function getSetId(item: any, legoUrl: string | null, name: string | null): string | null {
  const upc = asFirstString(item?.upccode)?.trim() ?? null;
  const sku = asFirstString(item?.sku)?.trim() ?? null;

  const candidate = upc || sku;
  if (candidate && isProbablyLegoSetNumber(candidate)) return candidate;

  return extractSetNumberFromLegoUrl(legoUrl) ?? extractSetNumberFromName(name) ?? null;
}

function getName(item: any): string | null {
  return asFirstString(item?.productname)?.trim() ?? null;
}

function getImageUrl(item: any): string | null {
  return asFirstString(item?.imageurl)?.trim() ?? null;
}

/**
 * Rakuten gives linkurl; we treat that as outbound affiliate-ish link.
 * For scraping, we normalize to the real lego.com URL via murl.
 */
function getLegoUrl(item: any): string | null {
  return asFirstString(item?.linkurl)?.trim() ?? null;
}

function getRawPrice(item: any): string | null {
  const p0 = item?.price?.[0];
  const p = p0?._ ?? p0 ?? item?.price?._ ?? item?.price ?? null;
  return p == null ? null : String(p).trim();
}

function logSkip(reason: string, name: string | null, extra?: any) {
  console.warn(`⛔ Skipped (${reason}): ${name ?? "(no name)"}`, extra ?? "");
}

async function main() {
  const { limit, dryRun, verbose } = parseArgs();

  const products = await fetchAllLegoProducts();
  const list = typeof limit === "number" ? products.slice(0, limit) : products;

  const lastState = new Map<string, { price: number | null; inStock: boolean | null }>();

  const existing = await prisma.priceHistory.findMany({
    where: { retailer: "LEGO" },
    orderBy: { recordedAt: "desc" },
    select: { setIdRef: true, price: true, inStock: true },
  });

  for (const row of existing) {
    const key = `${row.setIdRef}::LEGO`;
    if (!lastState.has(key)) {
      lastState.set(key, { price: row.price, inStock: row.inStock });
    }
  }

  let synced = 0;
  let skipped = 0;
  let createdHistory = 0;
  let noChange = 0;

  for (const item of list) {
    const name = getName(item);
    const imageUrl = getImageUrl(item);

    const rakutenLinkUrl = getLegoUrl(item); // outbound link (often contains murl)
    const canonicalUrl = rakutenLinkUrl ? extractMurl(rakutenLinkUrl) ?? rakutenLinkUrl : null; // real lego.com

    // Use canonical URL for extracting set ID (more stable)
    const setId = getSetId(item, canonicalUrl, name);

    const rawPrice = getRawPrice(item);
    const priceCents = parsePriceToCents(rawPrice);
    const inStock = priceCents !== null;

    const decision = isBuildableLegoSet({
      title: name,
      brand: asFirstString(item?.brand) ?? null,
      setId,
      categoryName: asFirstString(item?.categoryname) ?? asFirstString(item?.category) ?? null,
      categoryPath: asFirstString(item?.categorypath) ?? null,
    });

    if (!decision.ok) {
      logSkip(`filter:${decision.reason}`, name);
      skipped++;
      continue;
    }

    const finalSetId = decision.setNumber ?? setId;

    if (!finalSetId || !imageUrl) {
      logSkip("missing-data", name, { finalSetId, imageUrl });
      skipped++;
      continue;
    }

    const key = `${finalSetId}::LEGO`;
    const prev = lastState.get(key);
    const changed = !prev || prev.price !== priceCents || prev.inStock !== inStock;

    if (!changed) {
      noChange++;
      continue;
    }

    if (dryRun) {
      console.log(`🧪 Dry-run: ${finalSetId} | ${priceCents ?? "null"}c`);
      lastState.set(key, { price: priceCents, inStock });
      synced++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // ✅ DO NOT TOUCH MSRP — EVER
      // Set.legoUrl/canonicalUrl should be the REAL lego.com URL so /api/refresh/lego works.
      await tx.set.upsert({
        where: { setId: finalSetId },
        update: {
          name,
          imageUrl,
          legoUrl: canonicalUrl,
          canonicalUrl: canonicalUrl,
          advertiserId: process.env.RAKUTEN_LEGO_MID ?? null,
          lastSyncedAt: new Date(),
        },
        create: {
          setId: finalSetId,
          name,
          imageUrl,
          legoUrl: canonicalUrl,
          canonicalUrl: canonicalUrl,
          advertiserId: process.env.RAKUTEN_LEGO_MID ?? null,
          lastSyncedAt: new Date(),
        },
      });

      // Offer.url should be the OUTBOUND link users click.
      // Prefer Rakuten linkurl; if missing, fall back to canonical.
      const outboundUrl = rakutenLinkUrl ?? canonicalUrl ?? null;

      await tx.offer.upsert({
        where: {
          setIdRef_retailer: {
            setIdRef: finalSetId,
            retailer: "LEGO",
          },
        },
        update: {
          price: priceCents,
          url: outboundUrl,
          inStock,
          updatedAt: new Date(),
        },
        create: {
          setIdRef: finalSetId,
          retailer: "LEGO",
          price: priceCents,
          url: outboundUrl,
          inStock,
        },
      });

      await tx.priceHistory.create({
        data: {
          setIdRef: finalSetId,
          retailer: "LEGO",
          price: priceCents,
          inStock,
        },
      });
    });

    createdHistory++;
    synced++;
    lastState.set(key, { price: priceCents, inStock });

    if (verbose) {
      console.log(`✅ Synced: ${finalSetId} | ${priceCents ?? "null"}c`);
    }
  }

  console.log(
    `✅ Rakuten sync complete: synced=${synced}, skipped=${skipped}, noChange=${noChange}, priceHistoryInserted=${createdHistory}`
  );

  // ✅ literally "at the end of main": after sync completes
  await triggerLegoRefreshAfterSync();
}

main()
  .catch((err) => {
    console.error("❌ Rakuten sync failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });