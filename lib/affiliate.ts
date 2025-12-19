// lib/affiliate.ts
const enc = encodeURIComponent;

/**
 * Rakuten / LinkShare (LinkSynergy) settings
 *
 * - RAKUTEN_PUBLISHER_ID: looks like "ymzYtGY2iZw" (from your Copy Link Code)
 * - RAKUTEN_LEGO_MID: "13923" (not required for the "link" URL, but fine to keep)
 */
export const RAKUTEN_PUBLISHER_ID =
  process.env.RAKUTEN_PUBLISHER_ID || process.env.NEXT_PUBLIC_RAKUTEN_PUBLISHER_ID || "";

export const RAKUTEN_LEGO_MID =
  process.env.RAKUTEN_LEGO_MID || process.env.NEXT_PUBLIC_RAKUTEN_LEGO_MID || "13923";

/**
 * Build a Rakuten "link" URL (this matches what "Copy link code" gives you).
 *
 * Example from your dashboard:
 * https://click.linksynergy.com/link?id=ymzYtGY2iZw&offerid=1606623.139239885619449048605586&type=2&murl=https%3a%2f%2fwww.lego.com%2fen-us%2fproduct%2f...-77238
 */
export function rakutenLinkUrl(params: {
  destinationUrl: string;
  offerId: string;
  u1?: string;
}) {
  const { destinationUrl, offerId, u1 } = params;

  if (!RAKUTEN_PUBLISHER_ID) {
    // If missing, we still return the raw destination so the app works locally.
    return destinationUrl;
  }

  const base = `https://click.linksynergy.com/link?id=${enc(RAKUTEN_PUBLISHER_ID)}&offerid=${enc(
    offerId
  )}&type=2&murl=${enc(destinationUrl)}`;

  // Optional subid tracking (Rakuten supports "u1" on many programs; safe to include when present)
  return u1 ? `${base}&u1=${enc(u1)}` : base;
}

/**
 * LEGO destination URLs
 * If you don't have the exact product page URL/slug yet, we fall back to search.
 */
export function legoSearchUrl(setId: string) {
  return `https://www.lego.com/en-us/search?q=${enc(setId)}`;
}

/**
 * Build a LEGO affiliate URL that goes to a PRODUCT PAGE when you have the offerId.
 * If offerId is missing, falls back to LEGO search page (non-affiliate) so nothing breaks.
 */
export function legoAffiliateUrlFromProductPage(params: {
  setId: string;
  destinationUrl?: string; // product page preferred
  offerId?: string; // required to produce Rakuten affiliate link
}) {
  const { setId, destinationUrl, offerId } = params;

  const dest = destinationUrl || legoSearchUrl(setId);

  // Without offerId, we can't create the exact product affiliate link you copied.
  if (!offerId) return dest;

  return rakutenLinkUrl({
    destinationUrl: dest,
    offerId,
    u1: setId,
  });
}

// Amazon
export const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG || "setpricetracker-20";
export function amazonSearchUrl(setId: string) {
  return `https://www.amazon.com/s?k=${enc(`LEGO ${setId}`)}&tag=${enc(AMAZON_TAG)}`;
}

// Walmart / Target
export function walmartSearchUrl(setId: string) {
  return `https://www.walmart.com/search?q=${enc(`LEGO ${setId}`)}`;
}

export function targetSearchUrl(setId: string) {
  return `https://www.target.com/s?searchTerm=${enc(`LEGO ${setId}`)}`;
}