// scripts/sync-rakuten.ts
import "dotenv/config";
import { fetchAllLegoProducts } from "@/lib/rakuten";
import { parsePriceToCents } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { classifyLegoProduct } from "@/lib/rakuten/shouldIncludeProduct";
import { RAKUTEN_LEGO_RETAILER } from "@/lib/retailer";

/**
 * IMPORTANT:
 * - Rakuten feed often shows MSRP and may not reflect lego.com discounts.
 * - DO NOT write Rakuten pricing into retailer="LEGO" because that will overwrite
 *   the lego.com scraper's discount price.
 *
 * We store Rakuten's LEGO offer as retailer="RAKUTEN_LEGO" instead.
 * Then the app can pick the lowest price across retailers.
 */
/**
 * ✅ Your DB currently does NOT have Set.productType / Set.setNumber columns.
 * If you later add them, set this env var to "1" to enable writing.
 *
 * Examples:
 *  - SET_HAS_CLASSIFICATION_COLUMNS=1
 */
const SET_HAS_CLASSIFICATION_COLUMNS =
  String(process.env.SET_HAS_CLASSIFICATION_COLUMNS ?? "").trim() === "1";

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

  const url = new URL("/api/refresh/lego", base);

  // Optional knobs
  url.searchParams.set("all", "1");
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
      total: (data as any)?.total,
      refreshed: (data as any)?.refreshed,
      failed: (data as any)?.failed,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? err);

    // If your Next server isn't running locally, don't fail the whole sync.
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

function getSetIdCandidate(item: any, legoUrl: string | null, name: string | null): string | null {
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
function getRakutenLinkUrl(item: any): string | null {
  return asFirstString(item?.linkurl)?.trim() ?? null;
}

function getRawPrice(item: any): string | null {
  const p0 = (item as any)?.price?.[0];
  const p = (p0 as any)?._ ?? p0 ?? (item as any)?.price?._ ?? (item as any)?.price ?? null;
  return p == null ? null : String(p).trim();
}

function getRakutenProductId(item: any): string | null {
  return asFirstString(item?.productid)?.trim() ?? null;
}

function logSkip(reason: string, name: string | null, extra?: any) {
  console.warn(`⛔ Skipped (${reason}): ${name ?? "(no name)"}`, extra ?? "");
}

function makeNonSetId(rakutenProductId: string | null, sku: string | null, upc: string | null) {
  if (rakutenProductId) return `rk-${rakutenProductId}`;
  if (sku) return `rk-sku-${sku}`;
  if (upc) return `rk-upc-${upc}`;
  return `rk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function main() {
  const { limit, dryRun, verbose } = parseArgs();

  const products = await fetchAllLegoProducts();
  const list = typeof limit === "number" ? products.slice(0, limit) : products;

  // Track last known state based on priceHistory for the Rakuten retailer label
  const lastState = new Map<string, { price: number | null; inStock: boolean | null }>();

  const existing = await prisma.priceHistory.findMany({
    where: { retailer: RAKUTEN_LEGO_RETAILER },
    orderBy: { recordedAt: "desc" },
    select: { setIdRef: true, price: true, inStock: true },
  });

  for (const row of existing) {
    const key = `${row.setIdRef}::${RAKUTEN_LEGO_RETAILER}`;
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

    const rakutenLinkUrl = getRakutenLinkUrl(item);
    const canonicalUrl = rakutenLinkUrl ? extractMurl(rakutenLinkUrl) ?? rakutenLinkUrl : null;

    const rakutenProductId = getRakutenProductId(item);
    const sku = asFirstString((item as any)?.sku)?.trim() ?? null;
    const upc = asFirstString((item as any)?.upccode)?.trim() ?? null;

    const setIdCandidate = getSetIdCandidate(item, canonicalUrl, name);

    const rawPrice = getRawPrice(item);
    const priceCents = parsePriceToCents(rawPrice);
    const inStock = priceCents !== null;

    // ✅ classify (used for picking a stable ID); only written to DB if columns exist
    const classified = classifyLegoProduct({
      title: name,
      brand: asFirstString((item as any)?.brand) ?? null,
      setId: setIdCandidate,
      categoryName: asFirstString((item as any)?.categoryname) ?? asFirstString((item as any)?.category) ?? null,
      categoryPath: asFirstString((item as any)?.categorypath) ?? null,
    });

    const productType = classified.type;

    const finalSetId =
      productType === "SET" && classified.setNumber
        ? classified.setNumber
        : makeNonSetId(rakutenProductId, sku, upc);

    if (!finalSetId || !imageUrl) {
      logSkip("missing-data", name, { finalSetId, imageUrl, productType, rakutenProductId, sku, upc });
      skipped++;
      continue;
    }

    const key = `${finalSetId}::${RAKUTEN_LEGO_RETAILER}`;
    const prev = lastState.get(key);
    const changed = !prev || prev.price !== priceCents || prev.inStock !== inStock;

    if (!changed) {
      noChange++;
      continue;
    }

    if (dryRun) {
      console.log(
        `🧪 Dry-run: ${finalSetId} | ${productType} | ${priceCents ?? "null"}c (${RAKUTEN_LEGO_RETAILER})`
      );
      lastState.set(key, { price: priceCents, inStock });
      synced++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Offer.url should be the OUTBOUND link users click.
      const outboundUrl = rakutenLinkUrl ?? canonicalUrl ?? null;

      // ✅ Build update/create payloads WITHOUT classification unless DB has columns
      const baseUpdate: any = {
        name,
        imageUrl,
        legoUrl: canonicalUrl,
        canonicalUrl: canonicalUrl,
        advertiserId: process.env.RAKUTEN_LEGO_MID ?? null,
        lastSyncedAt: new Date(),
        rakutenProductId: rakutenProductId ?? null,
      };

      const baseCreate: any = {
        setId: finalSetId,
        name,
        imageUrl,
        legoUrl: canonicalUrl,
        canonicalUrl: canonicalUrl,
        advertiserId: process.env.RAKUTEN_LEGO_MID ?? null,
        lastSyncedAt: new Date(),
        rakutenProductId: rakutenProductId ?? null,
      };

      if (SET_HAS_CLASSIFICATION_COLUMNS) {
        baseUpdate.productType = productType;
        baseUpdate.setNumber = productType === "SET" ? (classified.setNumber ?? finalSetId) : null;

        baseCreate.productType = productType;
        baseCreate.setNumber = productType === "SET" ? (classified.setNumber ?? finalSetId) : null;
      }

      await tx.set.upsert({
        where: { setId: finalSetId },
        update: baseUpdate,
        create: baseCreate,
      });

      // ✅ store Rakuten in its own retailer label so it can't overwrite lego.com scraped price
      await tx.offer.upsert({
        where: {
          setIdRef_retailer: {
            setIdRef: finalSetId,
            retailer: RAKUTEN_LEGO_RETAILER,
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
          retailer: RAKUTEN_LEGO_RETAILER,
          price: priceCents,
          url: outboundUrl,
          inStock,
        },
      });

      await tx.priceHistory.create({
        data: {
          setIdRef: finalSetId,
          retailer: RAKUTEN_LEGO_RETAILER,
          price: priceCents,
          inStock,
        },
      });
    });

    createdHistory++;
    synced++;
    lastState.set(key, { price: priceCents, inStock });

    if (verbose) {
      console.log(
        `✅ Synced: ${finalSetId} | ${productType} | ${priceCents ?? "null"}c (${RAKUTEN_LEGO_RETAILER})`
      );
    }
  }

  console.log(
    `✅ Rakuten sync complete: synced=${synced}, skipped=${skipped}, noChange=${noChange}, priceHistoryInserted=${createdHistory}`
  );

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
