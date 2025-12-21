// lib/rakuten/shouldIncludeProduct.ts

export type FilterInput = {
    title?: string | null;
    brand?: string | null;
    setId?: string | null;
    categoryName?: string | null;
    categoryPath?: string | null;
  };
  
  const NEGATIVE_KEYWORDS = [
    // accessories / gear
    "keychain",
    "key chain",
    "bag tag",
    "lanyard",
    "wallet",
    "watch",
    "umbrella",
    "towel",
    "bottle",
    "mug",
    "cup",
    "pen",
    "pencil",
    "notebook",
    "stationery",
    "badge",
    "patch",
    "sticker",
    "magnet",
    "plush",
    "stuffed",
    "puzzle",
    "calendar",
    "book",
    "novel",
    "magazine",
  
    // clothing
    "shirt",
    "t-shirt",
    "tee",
    "hoodie",
    "sweatshirt",
    "pants",
    "shorts",
    "jacket",
    "socks",
    "shoes",
    "nike",
    "adidas",
  
    // storage / decor
    "storage",
    "shelf",
    "drawer",
    "container",
  
    // electronics / components
    "light",
    "lamp",
    "led",
    "battery",
    "motor",
    "hub",
    "sensor",
    "remote",
    "switch",
    "wire",
    "cable",
  
    // toy weapons / cosplay style gear
    "sword",
    "katana",
    "sheath",
  ];
  
  const NEGATIVE_CATEGORY_HINTS = [
    "gear",
    "accessories",
    "apparel",
    "clothing",
    "home",
    "decor",
    "stationery",
    "book",
    "puzzle",
    "keychain",
    "bag",
    "backpack",
    "lighting",
  ];
  
  function norm(s: string | null | undefined): string {
    return (s ?? "").toLowerCase().trim();
  }
  
  function hasNegativeKeyword(text: string): boolean {
    const t = text.toLowerCase();
    return NEGATIVE_KEYWORDS.some((kw) => t.includes(kw));
  }
  
  function looksLikeGearCategory(categoryName?: string | null, categoryPath?: string | null): boolean {
    const hay = `${categoryName ?? ""} ${categoryPath ?? ""}`.toLowerCase();
    return NEGATIVE_CATEGORY_HINTS.some((kw) => hay.includes(kw));
  }
  
  /**
   * Buildable LEGO set numbers are usually 4–5 digits (modern sets).
   * 6-digit numbers (e.g. 850807, 854305, 88005) are typically merch / components / accessories.
   */
  function isBuildableSetNumber(id: string): boolean {
    const s = id.trim();
    if (!/^\d{4,5}$/.test(s)) return false;
    if (s.startsWith("500")) return false;   // LEGO merch SKUs
    if (s.startsWith("2000")) return false;  // education/bundles/etc
    return true;
  }
  
  /**
   * Extract the first 4–5 digit set number from text.
   */
  function extractBuildableSetNumber(text: string): string | null {
    const matches = text.match(/\b\d{4,6}\b/g);
    if (!matches) return null;
  
    // Prefer 5-digit, then 4-digit. (Ignore 6-digit.)
    const five = matches.find((m) => m.length === 5 && isBuildableSetNumber(m));
    if (five) return five;
  
    const four = matches.find((m) => m.length === 4 && isBuildableSetNumber(m));
    if (four) return four;
  
    return null;
  }
  
  export function isBuildableLegoSet(
    input: FilterInput
  ): { ok: boolean; setNumber?: string; reason?: string } {
    const title = (input.title ?? "").trim();
    const brand = norm(input.brand);
    const catName = input.categoryName ?? "";
    const catPath = input.categoryPath ?? "";
  
    const titleLower = title.toLowerCase();
  
    // If brand is present and it's clearly NOT lego, reject.
    // If brand is missing, don't reject (Rakuten fields can be inconsistent).
    if (brand && !brand.includes("lego") && brand !== "the lego group") {
      return { ok: false, reason: "not-lego-brand" };
    }
  
    // Category-based reject
    if (looksLikeGearCategory(catName, catPath)) {
      return { ok: false, reason: "gear-category" };
    }
  
    // Keyword-based reject (kills keychains, swords, lights, etc.)
    if (hasNegativeKeyword(titleLower) || hasNegativeKeyword(`${catName} ${catPath}`.toLowerCase())) {
      return { ok: false, reason: "negative-keyword" };
    }
  
    // Use setId if it looks like a real buildable set number; otherwise try the title.
    const fromSetId = input.setId && isBuildableSetNumber(input.setId) ? input.setId : null;
    const fromTitle = extractBuildableSetNumber(title);
  
    const setNumber = fromSetId ?? fromTitle;
  
    if (!setNumber) {
      return { ok: false, reason: "missing-4-5-digit-set-number" };
    }
  
    return { ok: true, setNumber };
  }