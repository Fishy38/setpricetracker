// lib/rakuten/shouldIncludeProduct.ts
// Classifies Rakuten LEGO results into:
// "SET" | "MERCH" | "PARTS" | "OTHER"
//
// Goal:
// - Clothes/accessories go to MERCH
// - Components/electronics go to PARTS
// - Real buildable sets go to SET (setNumber filled)
// - Everything else goes OTHER
//
// This is intentionally heuristic + keyword-based.

export type ProductType = "SET" | "MERCH" | "PARTS" | "OTHER";

export function classifyLegoProduct(input: {
  title: string | null;
  brand: string | null;
  setId: string | null;
  categoryName: string | null;
  categoryPath: string | null;
}): { type: ProductType; setNumber: string | null; reason?: string } {
  const title = (input.title ?? "").trim();
  const brand = (input.brand ?? "").trim();
  const cat = (input.categoryName ?? "").trim();
  const path = (input.categoryPath ?? "").trim();
  const setId = (input.setId ?? "").trim();

  const hay = `${title} ${brand} ${cat} ${path}`.toLowerCase();

  // --- helpers
  const looksLikeSetNumber = (s: string) => /^\d{4,6}$/.test(s);
  const isProbablySetNumber = (s: string) => {
    if (!looksLikeSetNumber(s)) return false;
    // your previous rules
    if (s.startsWith("500")) return false;
    if (s.startsWith("2000")) return false;
    return true;
  };

  const extractSetNumber = (): string | null => {
    // prefer explicit setId candidate
    if (setId && isProbablySetNumber(setId)) return setId;

    // find first 4-6 digit in title
    const m = title.match(/\b(\d{4,6})\b/);
    if (m?.[1] && isProbablySetNumber(m[1])) return m[1];

    return null;
  };

  // --- Keyword buckets

  // Apparel/accessories that should be MERCH
  const merchKeywords = [
    "t-shirt",
    "t shirt",
    "tee",
    "hoodie",
    "sweatshirt",
    "sweater",
    "jacket",
    "coat",
    "pants",
    "shorts",
    "leggings",
    "pajama",
    "pj",
    "sleepwear",
    "shirt",
    "jersey",
    "hat",
    "cap",
    "beanie",
    "scarf",
    "gloves",
    "socks",
    "backpack",
    "bag",
    "tote",
    "lunchbox",
    "water bottle",
    "bottle",
    "keychain",
    "key chain",
    "wallet",
    "sticker",
    "mug",
    "cup",
    "blanket",
    "poster",
    "book",
    "comic",
    "minifigure display",
    "display case",
  ];

  // Components/electronics that should be PARTS
  const partsKeywords = [
    "motor",
    "xl motor",
    "l motor",
    "m motor",
    "servo",
    "hub",
    "battery",
    "battery box",
    "rechargeable",
    "charger",
    "cable",
    "wire",
    "remote",
    "controller",
    "sensor",
    "light",
    "led",
    "power functions",
    "powered up",
    "technic motor",
    "technic hub",
    "technic battery",
    "train motor",
  ];

  const includesAny = (keywords: string[]) =>
    keywords.some((k) => hay.includes(k));

  // --- Classification priority

  // 1) If it screams apparel/accessory, it's MERCH (even if it contains a number)
  if (includesAny(merchKeywords)) {
    return { type: "MERCH", setNumber: null, reason: "merch-keyword" };
  }

  // 2) If it screams components/electronics, it's PARTS
  if (includesAny(partsKeywords)) {
    return { type: "PARTS", setNumber: null, reason: "parts-keyword" };
  }

  // 3) If we can confidently extract a set number, call it SET
  const sn = extractSetNumber();
  if (sn) {
    return { type: "SET", setNumber: sn, reason: "set-number" };
  }

  // 4) Otherwise OTHER
  return { type: "OTHER", setNumber: null, reason: "fallback" };
}