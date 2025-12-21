// lib/rakuten.ts
import { parseStringPromise } from "xml2js";

const PRODUCT_SEARCH_URL = "https://productsearch.linksynergy.com/productsearch";

export function getDeepLink(merchantId: string, destinationUrl: string): string {
  const pub = process.env.RAKUTEN_PUBLISHER_ID;
  if (!pub) return destinationUrl;

  return `https://click.linksynergy.com/deeplink?id=${encodeURIComponent(
    pub
  )}&mid=${encodeURIComponent(merchantId)}&murl=${encodeURIComponent(destinationUrl)}`;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Decodes the real destination URL from Rakuten linkurl (deeplink) if it contains murl=...
 */
export function extractMurl(
  affiliateUrl: string | null | undefined
): string | null {
  if (!affiliateUrl) return null;
  try {
    const u = new URL(affiliateUrl);
    const murl = u.searchParams.get("murl");
    if (!murl) return null;
    return decodeURIComponent(murl);
  } catch {
    return null;
  }
}

/**
 * Generic Rakuten productsearch pagination:
 * Rakuten returns HTTP 400 when you go past the last page.
 *
 * IMPORTANT:
 * - This now supports keyword filtering via the `keyword` param.
 * - If keyword is set, total pages should drop drastically.
 */
async function fetchAllProductsByMid(mid: string, keyword?: string): Promise<any[]> {
  const webServiceToken = process.env.RAKUTEN_WEB_SERVICE_TOKEN;

  if (!mid || !webServiceToken) {
    throw new Error("Missing Rakuten credentials (MID / RAKUTEN_WEB_SERVICE_TOKEN)");
  }

  const results: any[] = [];
  const max = 100;
  let page = 1;

  while (true) {
    const url = new URL(PRODUCT_SEARCH_URL);
    url.searchParams.set("token", webServiceToken);
    url.searchParams.set("mid", mid);
    url.searchParams.set("max", String(max));
    url.searchParams.set("pagenumber", String(page));

    // ✅ This is the missing piece: pass keyword through to Rakuten
    // Rakuten productsearch supports keyword filtering here.
    if (keyword && keyword.trim()) {
      url.searchParams.set("keyword", keyword.trim());
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/xml" },
      cache: "no-store",
    });

    // ✅ IMPORTANT: Rakuten returns 400 when page > total pages
    if (res.status === 400) {
      console.log(`ℹ️ Rakuten pagination complete at page ${page}`);
      break;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Rakuten productsearch failed: ${res.status}\n${text.slice(0, 300)}`
      );
    }

    const text = await res.text();
    const parsed = await parseStringPromise(text, { explicitArray: false });

    const items = parsed?.result?.item;
    const products = asArray(items);

    if (!products.length) {
      console.log(`ℹ️ No products on page ${page}, stopping.`);
      break;
    }

    results.push(...products);
    console.log(
      `📦 Page ${page}: Fetched ${products.length}${keyword ? ` (keyword="${keyword}")` : ""}`
    );

    // Small optimization: if we got less than max, it's probably the last page
    if (products.length < max) {
      console.log(`ℹ️ Last page likely reached at page ${page} (fetched ${products.length} < ${max}).`);
      break;
    }

    page++;

    // hard safety stop
    if (page > 200) break;
  }

  return results;
}

export async function fetchAllLegoProducts(): Promise<any[]> {
  const advertiserId = process.env.RAKUTEN_LEGO_MID;
  if (!advertiserId) {
    throw new Error("Missing RAKUTEN_LEGO_MID");
  }

  const results = await fetchAllProductsByMid(advertiserId);
  console.log(`✅ Total LEGO products fetched: ${results.length}`);
  return results;
}

export async function fetchAllGiftcardProducts(keyword?: string): Promise<any[]> {
  const advertiserId = process.env.RAKUTEN_GIFTCARD_MID;
  if (!advertiserId) {
    throw new Error("Missing RAKUTEN_GIFTCARD_MID");
  }

  // ✅ pass keyword through so Rakuten filters server-side
  const results = await fetchAllProductsByMid(advertiserId, keyword);

  console.log(
    `✅ Total Giftcard.com products fetched: ${results.length}${keyword ? ` (keyword="${keyword}")` : ""}`
  );

  return results;
}