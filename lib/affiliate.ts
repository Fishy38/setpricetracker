// lib/affiliate.ts
const enc = encodeURIComponent;

/**
 * Amazon
 */
export const AMAZON_TAG =
  process.env.NEXT_PUBLIC_AMAZON_TAG || "setpricetracker-20";

export function amazonSearchUrl(setId: string) {
  return `https://www.amazon.com/s?k=${enc(`LEGO ${setId}`)}&tag=${enc(AMAZON_TAG)}`;
}

/**
 * Walmart / Target (plain search for now)
 */
export function walmartSearchUrl(setId: string) {
  return `https://www.walmart.com/search?q=${enc(`LEGO ${setId}`)}`;
}

export function targetSearchUrl(setId: string) {
  return `https://www.target.com/s?searchTerm=${enc(`LEGO ${setId}`)}`;
}

/**
 * Rakuten / LinkShare
 *
 * IMPORTANT:
 * - RAKUTEN_PUBLISHER_ID must be the token-looking value (e.g. "ymzYtGY2iZw"),
 *   NOT your numeric SID.
 */
export const RAKUTEN_PUBLISHER_ID =
  process.env.RAKUTEN_PUBLISHER_ID ||
  process.env.NEXT_PUBLIC_RAKUTEN_PUBLISHER_ID ||
  "";

export const LEGO_MID =
  process.env.RAKUTEN_LEGO_MID ||
  process.env.NEXT_PUBLIC_RAKUTEN_LEGO_MID ||
  "13923"; // LEGO Brand Retail (US)

/**
 * Standard Rakuten deeplink. This is what you WANT long-term.
 * If RAKUTEN_PUBLISHER_ID is missing, we fall back to destinationUrl so your app still works.
 */
export function rakutenDeeplink(params: {
  destinationUrl: string;
  mid?: string;
  u1?: string; // optional tracking param
}) {
  const { destinationUrl, mid = LEGO_MID, u1 } = params;

  if (!RAKUTEN_PUBLISHER_ID) return destinationUrl;

  let url =
    `https://click.linksynergy.com/deeplink` +
    `?id=${enc(RAKUTEN_PUBLISHER_ID)}` +
    `&mid=${enc(mid)}` +
    `&murl=${enc(destinationUrl)}`;

  if (u1) url += `&u1=${enc(u1)}`;

  return url;
}

/**
 * LEGO.com URLs
 * - Search URL (fallback)
 */
export function legoSearchUrl(setId: string) {
  return `https://www.lego.com/en-us/search?q=${enc(setId)}`;
}

/**
 * Preferred: affiliate deeplink to an *actual product page* URL.
 * You MUST pass the real product URL (slugged), because LEGO product URLs aren’t just /product/{setId}.
 */
export function legoAffiliateUrlFromProductPage(destinationProductUrl: string, setId?: string) {
  return rakutenDeeplink({
    destinationUrl: destinationProductUrl,
    mid: LEGO_MID,
    u1: setId, // optional
  });
}

/**
 * When you copy “link code” from Rakuten, you get a product-specific offerid.
 * If you have that offerid, you can generate the exact same click URL Rakuten gave you:
 *
 * https://click.linksynergy.com/link?id=...&offerid=...&type=2&murl=...
 */
export function rakutenOfferLink(params: {
  destinationUrl: string;
  offerId: string; // e.g. "1606623.139239885619449048605586"
  type?: number; // Rakuten uses type=2 in your example
}) {
  const { destinationUrl, offerId, type = 2 } = params;

  if (!RAKUTEN_PUBLISHER_ID) return destinationUrl;

  return (
    `https://click.linksynergy.com/link` +
    `?id=${enc(RAKUTEN_PUBLISHER_ID)}` +
    `&offerid=${enc(offerId)}` +
    `&type=${enc(String(type))}` +
    `&murl=${enc(destinationUrl)}`
  );
}