// lib/rakuten/fetchProducts.ts

import { Parser } from "xml2js";

const PRODUCT_SEARCH_URL = "https://productsearch.linksynergy.com/productsearch";

export async function fetchRakutenProducts(keyword = "lego", limit = 10) {
  const token = process.env.RAKUTEN_WEB_SERVICE_TOKEN;
  if (!token) throw new Error("Missing RAKUTEN_WEB_SERVICE_TOKEN in env");

  const url = new URL(PRODUCT_SEARCH_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/xml",
    },
  });

  const xml = await res.text();

  const parser = new Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(xml);

  const items = result?.result?.item ?? [];

  const mapped = Array.isArray(items) ? items : items ? [items] : [];

  return mapped.map((item: any) => ({
    name: item.productname ?? null,
    price: item.price?._ != null ? parseFloat(item.price._) : null,
    link: item.linkurl ?? null,
    image: item.imageurl ?? null,
    description: item.description?.short ?? null,
    upc: item.upccode ?? null,
  }));
}