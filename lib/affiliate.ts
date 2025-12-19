// lib/affiliate.ts
const enc = encodeURIComponent;

export const RAKUTEN_PUBLISHER_ID =
  process.env.RAKUTEN_PUBLISHER_ID ||
  process.env.NEXT_PUBLIC_RAKUTEN_PUBLISHER_ID ||
  "";

export const RAKUTEN_LEGO_MID =
  process.env.RAKUTEN_LEGO_MID ||
  process.env.NEXT_PUBLIC_RAKUTEN_LEGO_MID ||
  "13923";

export function rakutenLinkUrl(params: {
  destinationUrl: string;
  offerId: string;
  u1?: string;
}) {
  const { destinationUrl, offerId, u1 } = params;

  if (!RAKUTEN_PUBLISHER_ID) return destinationUrl;

  const base =
    `https://click.linksynergy.com/link?id=${enc(RAKUTEN_PUBLISHER_ID)}` +
    `&offerid=${enc(offerId)}` +
    `&type=2` +
    `&murl=${enc(destinationUrl)}`;

  return u1 ? `${base}&u1=${enc(u1)}` : base;
}

export function legoSearchUrl(setId: string) {
  return `https://www.lego.com/en-us/search?q=${enc(setId)}`;
}

export function legoAffiliateUrlFromProductPage(params: {
  setId: string;
  destinationUrl?: string;
  offerId?: string;
}) {
  const { setId, destinationUrl, offerId } = params;
  const dest = destinationUrl || legoSearchUrl(setId);
  if (!offerId) return dest;

  return rakutenLinkUrl({ destinationUrl: dest, offerId, u1: setId });
}

// ✅ alias for your current seed route import name
export const legoRakutenProductUrl = legoAffiliateUrlFromProductPage;

// Amazon
export const AMAZON_TAG =
  process.env.NEXT_PUBLIC_AMAZON_TAG || "setpricetracker-20";

export function amazonSearchUrl(setId: string) {
  return `https://www.amazon.com/s?k=${enc(`LEGO ${setId}`)}&tag=${enc(AMAZON_TAG)}`;
}

export function walmartSearchUrl(setId: string) {
  return `https://www.walmart.com/search?q=${enc(`LEGO ${setId}`)}`;
}

export function targetSearchUrl(setId: string) {
  return `https://www.target.com/s?searchTerm=${enc(`LEGO ${setId}`)}`;
}