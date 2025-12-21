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

/**
 * Build a Rakuten click URL. If u1 is present, Rakuten reports can show it.
 * That is your best “anti-hijack” signal (match sales back to click ids).
 */
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

/**
 * If you already have a Rakuten click URL, ensure it contains u1=cid.
 * (We also do this server-side in /out to guarantee it.)
 */
export function ensureRakutenU1(rawUrl: string, cid: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const isRakutenClick =
      host.includes("linksynergy.com") || host.includes("click.linksynergy.com");
    if (!isRakutenClick) return rawUrl;

    if (!u.searchParams.get("u1")) u.searchParams.set("u1", cid);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export function legoSearchUrl(setId: string) {
  return `https://www.lego.com/en-us/search?q=${enc(setId)}`;
}

export function legoAffiliateUrlFromProductPage(params: {
  setId: string;
  destinationUrl?: string;
  offerId?: string;
  cid?: string;
}) {
  const { setId, destinationUrl, offerId, cid } = params;
  const dest = destinationUrl || legoSearchUrl(setId);
  if (!offerId) return dest;

  // If cid is given, use it as u1; otherwise fall back to setId.
  return rakutenLinkUrl({ destinationUrl: dest, offerId, u1: cid ?? setId });
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