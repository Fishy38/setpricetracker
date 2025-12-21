// scripts/test-rakuten.ts

import "dotenv/config";
import { fetchRakutenProducts } from "../lib/rakuten/fetchProducts";

(async () => {
  try {
    const products = await fetchRakutenProducts("lego", 5);
    console.log("✅ Products:", products);
  } catch (err) {
    console.error("❌ Failed to fetch products", err);
    process.exit(1);
  }
})();