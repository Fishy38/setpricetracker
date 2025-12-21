export function shouldIncludeProduct(item: Record<string, any>): boolean {
    const name = item?.productname?.[0]?.toLowerCase() ?? "";
  
    // ❌ Skip keychains and single bricks
    const blockedKeywords = [
      "key chain",
      "keychain",
      "key ring",
      "bracelet",
      "watch",
      "light",
      "light up",
      "sticker",
      "dotz",
      "dots",
      "pen",
      "notebook",
      "bag tag",
      "eraser",
      "storage box",
      "brick drawer",
      "mug",
      "tumbler",
      "bottle",
      "socks",
      "hat",
      "hat clip",
      "scarf",
      "brick",
      "parts",
      "accessory",
      "accessories",
      "separator",
      "magnets",
      "poster",
      "patch",
      "book",
      "calendar",
      "stationery",
      "ruler",
      "luggage tag",
      "tape",
      "buildable watch",
    ];
  
    const keepKeywords = [
      "set",
      "minifigure",
      "minifigures",
      "battle pack",
      "speed champions",
      "brickheadz",
      "modular",
      "technic",
      "creator",
      "friends",
      "ninjago",
      "disney",
      "star wars",
      "marvel",
      "dc",
      "city",
      "build",
    ];
  
    // ✅ Keep if any "keep" keyword matches
    if (keepKeywords.some((kw) => name.includes(kw))) {
      return true;
    }
  
    // ❌ Skip if any "blocked" keyword matches
    if (blockedKeywords.some((kw) => name.includes(kw))) {
      return false;
    }
  
    // Otherwise: keep if the name is long enough (e.g. ignore "2x2 Brick")
    if (name.length < 10) return false;
  
    return true;
  }