import fetch from "node-fetch";
import { getAccessToken } from "./auth.js";
import xml2js from "xml2js";

export async function fetchRakutenProducts(keyword = "lego", limit = 5) {
  const token = await getAccessToken();

  const res = await fetch(`https://api.linksynergy.com/productsearch/1.0?keyword=${keyword}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.statusText}`);
  }

  const xml = await res.text();

  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(xml);

  return result.result.item.map((item) => ({
    name: item.productname,
    price: parseFloat(item.price?._ || 0),
    link: item.linkurl,
    image: item.imageurl,
    description: item.description?.short,
    upc: item.upccode,
  }));
}