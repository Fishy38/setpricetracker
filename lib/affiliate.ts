// lib/affiliate.ts
const enc = encodeURIComponent;

// Amazon
export const AMAZON_TAG =
  process.env.NEXT_PUBLIC_AMAZON_TAG || "setpricetracker-20";

export function amazonSearchUrl(setId: string) {
  return `https://www.amazon.com/s?k=${enc(`LEGO ${setId}`)}&tag=${enc(AMAZON_TAG)}`;
}

// Walmart / Target (plain for now)
export function walmartSearchUrl(setId: string) {
  return `https://www.walmart.com/search?q=${enc(`LEGO ${setId}`)}`;
}

export function targetSearchUrl(setId: string) {
  return `https://www.target.com/s?searchTerm=${enc(`LEGO ${setId}`)}`;
}

// ✅ Rakuten / LinkShare (LEGO Brand Retail US)
export const RAKUTEN_SID =
  process.env.NEXT_PUBLIC_RAKUTEN_SID || "4636380"; // your SID
export const LEGO_MID =
  process.env.NEXT_PUBLIC_LEGO_MID || "13923"; // LEGO Brand Retail (US)

export function rakutenDeeplink(destinationUrl: string, mid: string = LEGO_MID) {
  return `https://click.linksynergy.com/deeplink?id=${enc(RAKUTEN_SID)}&mid=${enc(mid)}&murl=${enc(destinationUrl)}`;
}

// ✅ LEGO.com destination URLs (use search until you have exact product pages)
export function legoSearchUrl(setId: string) {
  return `https://www.lego.com/en-us/search?q=${enc(setId)}`;
}

export function legoAffiliateUrl(setId: string) {
  return rakutenDeeplink(legoSearchUrl(setId), LEGO_MID);
}