import { parseStringPromise } from 'xml2js';

const PRODUCT_SEARCH_URL = 'https://productsearch.linksynergy.com/productsearch';
const LINK_LOCATOR_URL = 'https://api.linksynergy.com/deeplink';

// 🔗 Deep Link builder (no need for token)
export function getDeepLink(merchantId: string, destinationUrl: string): string {
  return `https://click.linksynergy.com/deeplink?id=${process.env.RAKUTEN_PUBLISHER_ID}&mid=${merchantId}&murl=${encodeURIComponent(destinationUrl)}`;
}

/**
 * 🔍 Search for products by keyword using Rakuten's LinkShare Product Search API (XML)
 */
export async function searchProducts(keyword: string, advertiserId?: string): Promise<any[]> {
  const url = new URL(PRODUCT_SEARCH_URL);
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('publisherId', process.env.RAKUTEN_PUBLISHER_ID || '');
  url.searchParams.set('max', '100');

  if (advertiserId) {
    url.searchParams.set('mid', advertiserId);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/xml',
    },
  });

  const text = await res.text();
  const data = await parseStringPromise(text);
  const items = data?.result?.item ?? [];

  return items;
}

/**
 * 🧱 Fetch all LEGO products from Rakuten (paginated)
 */
export async function fetchAllLegoProducts(): Promise<any[]> {
  const advertiserId = process.env.RAKUTEN_LEGO_MID;
  const publisherId = process.env.RAKUTEN_PUBLISHER_ID;

  if (!advertiserId || !publisherId) {
    throw new Error('Missing RAKUTEN_LEGO_MID or RAKUTEN_PUBLISHER_ID in environment variables');
  }

  const results: any[] = [];
  const max = 100;
  let page = 1;

  while (true) {
    const url = new URL(PRODUCT_SEARCH_URL);
    url.searchParams.set('publisherId', publisherId);
    url.searchParams.set('mid', advertiserId);
    url.searchParams.set('max', max.toString());
    url.searchParams.set('pagenumber', page.toString());

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/xml',
      },
    });

    const text = await res.text();
    const data = await parseStringPromise(text);
    const products = data?.result?.item ?? [];

    if (products.length === 0) break;

    results.push(...products);
    console.log(`📦 Page ${page}: Fetched ${products.length} LEGO products`);
    page++;

    if (page > 50) break; // safety cap
  }

  console.log(`✅ Total LEGO products fetched from Rakuten: ${results.length}`);
  return results;
}