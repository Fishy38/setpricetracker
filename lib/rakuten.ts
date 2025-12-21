// lib/rakuten.ts

import { parseStringPromise } from "xml2js";
import { prisma } from "./prisma";
import { parsePriceToCents } from "./utils";

const PRODUCT_SEARCH_URL = "https://productsearch.linksynergy.com/productsearch";

export function getDeepLink(merchantId: string, destinationUrl: string): string {
  return `https://click.linksynergy.com/deeplink?id=${process.env.RAKUTEN_PUBLISHER_ID}&mid=${merchantId}&murl=${encodeURIComponent(destinationUrl)}`;
}

export async function fetchAllLegoProducts(): Promise<any[]> {
  const advertiserId = process.env.RAKUTEN_LEGO_MID;
  const webServiceToken = process.env.RAKUTEN_WEB_SERVICE_TOKEN;

  if (!advertiserId || !webServiceToken) {
    throw new Error("Missing Rakuten credentials");
  }

  const results: any[] = [];
  const max = 100;
  let page = 1;

  while (true) {
    const url = new URL(PRODUCT_SEARCH_URL);
    url.searchParams.set("token", webServiceToken);
    url.searchParams.set("mid", advertiserId);
    url.searchParams.set("max", max.toString());
    url.searchParams.set("pagenumber", page.toString());

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/xml",
      },
    });

    const text = await res.text();
    const data = await parseStringPromise(text);
    const products = data?.result?.item ?? [];

    if (products.length === 0) break;

    results.push(...products);
    console.log(`📦 Page ${page}: Fetched ${products.length}`);
    page++;

    if (page > 50) break;
  }

  console.log(`✅ Total LEGO products: ${results.length}`);
  return results;
}