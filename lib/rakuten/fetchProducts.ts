// lib/rakuten/fetchProducts.ts
import { Parser } from "xml2js";

const PRODUCT_SEARCH_URL = "https://productsearch.linksynergy.com/productsearch";

export type RakutenMappedProduct = {
  name: string | null;
  price: number | null; // dollars
  link: string | null;
  image: string | null;
  description: string | null;
  upc: string | null;
};

type FetchRakutenProductsOpts = {
  keyword?: string;
  limit?: number;
  timeoutMs?: number;
};

/**
 * Fetch products from Rakuten LinkShare Product Search.
 *
 * NOTE:
 * - This endpoint returns XML.
 * - Result shapes can be inconsistent (single item vs array, nested fields, etc).
 * - We normalize to a list of mapped products.
 */
export async function fetchRakutenProducts(
  keywordOrOpts: string | FetchRakutenProductsOpts = "lego",
  limitArg = 10
): Promise<RakutenMappedProduct[]> {
  const opts: FetchRakutenProductsOpts =
    typeof keywordOrOpts === "string"
      ? { keyword: keywordOrOpts, limit: limitArg }
      : keywordOrOpts;

  const keyword = (opts.keyword ?? "lego").trim() || "lego";
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.floor(opts.limit!)) : 10;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.max(1000, Math.floor(opts.timeoutMs!)) : 15_000;

  const token = process.env.RAKUTEN_WEB_SERVICE_TOKEN;
  if (!token) throw new Error("Missing RAKUTEN_WEB_SERVICE_TOKEN in env");

  const url = new URL(PRODUCT_SEARCH_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("limit", String(limit));

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let xml: string;
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/xml" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Rakuten ProductSearch failed: ${res.status} ${res.statusText}${body ? ` | ${body.slice(0, 200)}` : ""}`
      );
    }

    xml = await res.text();
  } finally {
    clearTimeout(t);
  }

  // `explicitArray: false` makes access nicer, but fields can still vary
  const parser = new Parser({
    explicitArray: false,
    trim: true,
    normalizeTags: false,
    normalize: false,
    explicitRoot: true,
  });

  const result = await parser.parseStringPromise(xml);

  const itemsRaw = result?.result?.item ?? [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];

  const asString = (v: any): string | null => {
    if (v == null) return null;
    if (typeof v === "string") return v.trim() || null;
    return String(v).trim() || null;
  };

  const asNumber = (v: any): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  return items.map((item: any) => {
    const priceNode = item?.price;
    const priceVal = priceNode?._ ?? priceNode ?? null;

    const descNode = item?.description;
    const descVal = descNode?.short ?? descNode ?? null;

    return {
      name: asString(item?.productname),
      price: asNumber(priceVal),
      link: asString(item?.linkurl),
      image: asString(item?.imageurl),
      description: asString(descVal),
      upc: asString(item?.upccode),
    };
  });
}