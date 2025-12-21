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

export async function fetchAllLegoProducts(): Promise<any[]> {
  const advertiserId = process.env.RAKUTEN_LEGO_MID;
  const webServiceToken = process.env.RAKUTEN_WEB_SERVICE_TOKEN;

  if (!advertiserId || !webServiceToken) {
    throw new Error(
      "Missing Rakuten credentials (RAKUTEN_LEGO_MID / RAKUTEN_WEB_SERVICE_TOKEN)"
    );
  }

  const results: any[] = [];
  const max = 100;
  let page = 1;

  while (true) {
    const url = new URL(PRODUCT_SEARCH_URL);
    url.searchParams.set("token", webServiceToken);
    url.searchParams.set("mid", advertiserId);
    url.searchParams.set("max", String(max));
    url.searchParams.set("pagenumber", String(page));

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
      throw new Error(`Rakuten productsearch failed: ${res.status}`);
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
    console.log(`📦 Page ${page}: Fetched ${products.length}`);
    page++;

    // hard safety stop
    if (page > 200) break;
  }

  console.log(`✅ Total LEGO products fetched: ${results.length}`);
  return results;
}