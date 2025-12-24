// app/api/refresh/amazon/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePriceToCents } from "@/lib/utils";
import { getAmazonSitestripeUrl } from "@/lib/amazon-sitestripe";
import { findLegoSetIdByName } from "@/lib/lego";

const AMAZON_RETAILER = "Amazon";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const PLACEHOLDER_IMAGE = "/placeholder-set.svg";

type RefreshInput = { setId: string; amazonUrl: string };

type RefreshResult = {
  setId: string;
  ok: boolean;
  amazonUrl: string | null;
  priceCents: number | null;
  inStock: boolean | null;
  error?: string;
};

type PriceCandidate = {
  cents: number;
  score: number;
  source: string;
};

export type RefreshAllResult = {
  ok: boolean;
  total: number;
  refreshed: number;
  failed: number;
  results: RefreshResult[];
  error?: string;
};

function normalizeAmazonUrl(raw: string | null | undefined): { url: string | null; error?: string } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { url: null, error: "Missing amazonUrl" };

  try {
    const u = new URL(trimmed);
    const protocol = u.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return { url: null, error: "Unsupported URL protocol" };
    }

    return { url: u.toString() };
  } catch {
    return { url: null, error: "Invalid amazonUrl" };
  }
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanAmazonTitle(input: string) {
  return stripHtml(input).replace(/\s*-?\s*Amazon\.com.*$/i, "").trim();
}

function isLikelySetId(value: string) {
  const v = String(value ?? "").trim();
  if (!/^\d{4,6}$/.test(v)) return false;
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  if (v.length === 4 && n >= 1900 && n <= 2099) return false;
  return true;
}

function pickLikelySetId(matches: string[]) {
  const unique = Array.from(new Set(matches ?? [])).filter(isLikelySetId);
  const five = unique.filter((m) => m.length === 5);
  if (five.length) return five[five.length - 1];
  const four = unique.filter((m) => m.length === 4);
  if (four.length) return four[four.length - 1];
  const six = unique.filter((m) => m.length === 6);
  if (six.length) return six[six.length - 1];
  return null;
}

function extractSetIdFromText(text: string | null | undefined) {
  const input = String(text ?? "");
  if (!input) return null;
  const matches = input.match(/\b\d{4,6}\b/g) ?? [];
  return pickLikelySetId(matches);
}

function extractProductTitle(html: string) {
  const m = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  if (m?.[1]) return cleanAmazonTitle(m[1]);
  const m2 = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (m2?.[1]) return cleanAmazonTitle(m2[1]);
  return null;
}

function extractNamesFromLd(ld: any[]): string[] {
  const nodes = flattenLd(ld);
  const out: string[] = [];
  for (const node of nodes) {
    const name = node?.name;
    if (typeof name === "string" && name.trim()) out.push(name.trim());
  }
  return out;
}

function extractImageFromLd(ld: any[]): string | null {
  const nodes = flattenLd(ld);
  for (const node of nodes) {
    const image = node?.image;
    if (typeof image === "string" && image.trim()) return image.trim();
    if (Array.isArray(image) && image.length) {
      const first = String(image[0] ?? "").trim();
      if (first) return first;
    }
    if (image && typeof image === "object") {
      const url = String(image.url ?? "").trim();
      if (url) return url;
    }
  }
  return null;
}

function extractMetaImage(html: string, prop: string) {
  const re = new RegExp(`property=[\"']${prop}[\"'][^>]*content=[\"']([^\"']+)[\"']`, "i");
  const m = html.match(re);
  return m?.[1] ?? null;
}

function parseDynamicImageAttribute(raw: string) {
  const cleaned = raw.replace(/&quot;/g, "\"");
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const first = Object.keys(parsed ?? {})[0];
    return first ? String(first) : null;
  } catch {
    return null;
  }
}

function extractAmazonImageUrl(html: string) {
  const ld = extractJsonLd(html);
  const fromLd = extractImageFromLd(ld);
  if (fromLd) return fromLd;

  const og = extractMetaImage(html, "og:image");
  if (og) return og;

  const twitter = html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitter?.[1]) return twitter[1];

  const landing =
    html.match(/id=["']landingImage["'][^>]*data-old-hires=["']([^"']+)["']/i) ??
    html.match(/id=["']landingImage["'][^>]*src=["']([^"']+)["']/i);
  if (landing?.[1]) return landing[1];

  const dynamic = html.match(/data-a-dynamic-image=["']([^"']+)["']/i);
  if (dynamic?.[1]) {
    const parsed = parseDynamicImageAttribute(dynamic[1]);
    if (parsed) return parsed;
  }

  return null;
}

function extractSetIdentityFromAmazonHtml(html: string) {
  const title = extractProductTitle(html);
  const fromTitle = extractSetIdFromText(title);
  if (fromTitle) return { setId: fromTitle, name: title };

  const ld = extractJsonLd(html);
  const names = extractNamesFromLd(ld);
  for (const name of names) {
    const hit = extractSetIdFromText(name);
    if (hit) return { setId: hit, name: cleanAmazonTitle(name) };
  }

  const modelMatch =
    html.match(/item model number[^0-9]*([0-9]{4,6})/i) ??
    html.match(/model number[^0-9]*([0-9]{4,6})/i);
  if (modelMatch?.[1] && isLikelySetId(modelMatch[1])) {
    return { setId: modelMatch[1], name: title ?? null };
  }

  return { setId: null, name: title ?? names[0] ?? null };
}

async function resolveSetIdentityFromAmazonHtml(html: string) {
  const extracted = extractSetIdentityFromAmazonHtml(html);
  if (extracted.setId) return extracted;

  const name = extracted.name;
  if (name && name.toLowerCase().includes("lego")) {
    const lookup = await findLegoSetIdByName(name);
    if (lookup && isLikelySetId(lookup)) {
      return { setId: lookup, name };
    }
  }

  return extracted;
}

async function ensureSetExists(setId: string, name: string | null) {
  const existing = await prisma.set.findUnique({
    where: { setId },
    select: { setId: true },
  });
  if (existing) return;

  await prisma.set.create({
    data: {
      setId,
      name: name ?? `LEGO Set ${setId}`,
      imageUrl: PLACEHOLDER_IMAGE,
    },
  });
}

async function updateSetImageIfPlaceholder(setId: string, imageUrl: string | null) {
  const next = String(imageUrl ?? "").trim();
  if (!next) return;

  const existing = await prisma.set.findUnique({
    where: { setId },
    select: { imageUrl: true },
  });
  if (!existing) return;

  const current = String(existing.imageUrl ?? "").trim();
  if (!current || current === PLACEHOLDER_IMAGE) {
    await prisma.set.update({
      where: { setId },
      data: { imageUrl: next },
    });
  }
}

async function getSetMsrpCents(setId: string) {
  const row = await prisma.set.findUnique({
    where: { setId },
    select: { msrp: true },
  });
  return typeof row?.msrp === "number" ? row.msrp : null;
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const txt = m[1]?.trim();
    if (!txt) continue;
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return out;
}

function flattenLd(nodes: any[]): any[] {
  const out: any[] = [];
  const stack = [...(nodes ?? [])];

  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;

    out.push(n);

    const g = n?.["@graph"];
    if (Array.isArray(g)) stack.push(...g);
  }

  return out;
}

function isUnitPriceSpec(spec: any) {
  if (!spec || typeof spec !== "object") return false;
  const type = String(spec["@type"] ?? spec.priceType ?? "").toLowerCase();
  if (type.includes("unitprice")) return true;
  if (spec.unitCode || spec.unitText || spec.referenceQuantity || spec.unitQuantity) return true;
  return false;
}

function addPriceCandidate(
  list: PriceCandidate[],
  raw: unknown,
  score: number,
  source: string
) {
  const cents = parsePriceToCents(raw);
  if (typeof cents !== "number" || cents <= 0) return;
  list.push({ cents, score, source });
}

function dedupeCandidates(candidates: PriceCandidate[]) {
  const bestByCents = new Map<number, PriceCandidate>();
  for (const c of candidates ?? []) {
    const existing = bestByCents.get(c.cents);
    if (!existing || c.score > existing.score) bestByCents.set(c.cents, c);
  }
  return Array.from(bestByCents.values());
}

function filterCandidatesByMsrp(candidates: PriceCandidate[], msrpCents: number | null) {
  if (!msrpCents || msrpCents <= 0) return candidates;
  const floor = Math.max(1, Math.round(msrpCents * 0.3));
  const above = candidates.filter((c) => c.cents >= floor);
  return above.length ? above : candidates;
}

function scoreCandidate(candidate: PriceCandidate, msrpCents: number | null) {
  let score = candidate.score;
  if (msrpCents && msrpCents > 0) {
    const ratio = candidate.cents / msrpCents;
    if (ratio < 0.3) score -= 40;
    else if (ratio < 0.45) score -= 10;
    if (ratio > 1.8) score -= 5;
  }
  return score;
}

function pickBestCandidate(candidates: PriceCandidate[], msrpCents: number | null) {
  const unique = dedupeCandidates(candidates);
  const filtered = filterCandidatesByMsrp(unique, msrpCents);
  if (!filtered.length) return null;

  return filtered.sort((a, b) => {
    const sa = scoreCandidate(a, msrpCents);
    const sb = scoreCandidate(b, msrpCents);
    if (sa !== sb) return sb - sa;
    if (msrpCents && msrpCents > 0) {
      const da = Math.abs(a.cents - msrpCents);
      const db = Math.abs(b.cents - msrpCents);
      if (da !== db) return da - db;
    }
    return b.cents - a.cents;
  })[0];
}

function collectLdCandidates(ld: any[]): { candidates: PriceCandidate[]; availability: unknown | null } {
  const nodes = flattenLd(ld);
  const candidates: PriceCandidate[] = [];
  let availability: unknown | null = null;

  const sellerBoost = (offer: any) => {
    const seller = offer?.seller;
    const name =
      typeof seller === "string"
        ? seller
        : typeof seller?.name === "string"
          ? seller.name
          : "";
    return name.toLowerCase().includes("amazon") ? 5 : 0;
  };

  const addSpecPrice = (spec: any, baseScore: number, source: string) => {
    if (!spec || typeof spec !== "object" || isUnitPriceSpec(spec)) return;
    addPriceCandidate(candidates, spec.price, baseScore, source);
  };

  const addOfferPrices = (offer: any) => {
    if (!offer) return;
    if (availability == null && offer.availability != null) availability = offer.availability;
    const boost = sellerBoost(offer);
    if (offer.price != null) addPriceCandidate(candidates, offer.price, 95 + boost, "ld-offer-price");

    const spec = offer.priceSpecification;
    if (Array.isArray(spec)) {
      for (const s of spec) addSpecPrice(s, 92 + boost, "ld-offer-price-spec");
    } else {
      addSpecPrice(spec, 92 + boost, "ld-offer-price-spec");
    }

    if (offer.lowPrice != null) {
      addPriceCandidate(candidates, offer.lowPrice, 70 + boost, "ld-offer-lowprice");
    }
    if (offer.highPrice != null) {
      addPriceCandidate(candidates, offer.highPrice, 55 + boost, "ld-offer-highprice");
    }
  };

  for (const node of nodes) {
    if (availability == null && node?.availability != null) availability = node.availability;

    const offers = node?.offers;
    if (Array.isArray(offers)) {
      for (const offer of offers) addOfferPrices(offer);
    } else if (offers) {
      addOfferPrices(offers);
    }

    if (node?.price != null) addPriceCandidate(candidates, node.price, 75, "ld-node-price");

    const nodeSpec = node?.priceSpecification;
    if (Array.isArray(nodeSpec)) {
      for (const s of nodeSpec) addSpecPrice(s, 72, "ld-node-price-spec");
    } else {
      addSpecPrice(nodeSpec, 72, "ld-node-price-spec");
    }

    if (node?.lowPrice != null) {
      addPriceCandidate(candidates, node.lowPrice, 60, "ld-node-lowprice");
    }
  }

  return { candidates, availability };
}

function availabilityToInStock(v: unknown): boolean | null {
  if (v == null) return null;
  const s = String(v).toLowerCase();
  if (s.includes("instock") || s.includes("in stock")) return true;
  if (s.includes("outofstock") || s.includes("out of stock")) return false;
  if (s.includes("unavailable") || s.includes("temporarily out")) return false;
  return null;
}

function extractAvailabilityFromHtml(html: string): boolean | null {
  const m = html.match(/id=["']availability["'][^>]*>([\s\S]*?)<\/div>/i);
  if (m?.[1]) return availabilityToInStock(stripHtml(m[1]));

  const m2 = html.match(/(In Stock|Currently unavailable|Out of stock|Temporarily out of stock)/i);
  if (m2?.[1]) return availabilityToInStock(m2[1]);

  return null;
}

function isUnitPriceContext(html: string, idx: number) {
  const windowStart = Math.max(0, idx - 40);
  const windowEnd = Math.min(html.length, idx + 60);
  const context = html.slice(windowStart, windowEnd).toLowerCase();
  return (
    context.includes("priceperunit") ||
    context.includes("price-per-unit") ||
    context.includes("unitprice") ||
    context.includes("unit-price") ||
    context.includes("per ounce") ||
    context.includes("per oz") ||
    context.includes("per lb") ||
    context.includes("per count") ||
    context.includes("per item") ||
    context.includes("per unit") ||
    context.includes("/oz") ||
    context.includes("/ounce") ||
    context.includes("/lb")
  );
}

function isInstallmentContext(html: string, idx: number) {
  const windowStart = Math.max(0, idx - 60);
  const windowEnd = Math.min(html.length, idx + 80);
  const context = html.slice(windowStart, windowEnd).toLowerCase();
  return (
    context.includes("per month") ||
    context.includes("per week") ||
    context.includes("weeks") ||
    context.includes("months") ||
    context.includes("installment") ||
    context.includes("payments") ||
    context.includes("pay over time") ||
    context.includes("klarna") ||
    context.includes("affirm") ||
    context.includes("x4")
  );
}

function isListPriceContext(html: string, idx: number) {
  const windowStart = Math.max(0, idx - 80);
  const windowEnd = Math.min(html.length, idx + 80);
  const context = html.slice(windowStart, windowEnd).toLowerCase();
  return (
    context.includes("list price") ||
    context.includes("price was") ||
    context.includes("was:") ||
    context.includes("was price") ||
    context.includes("a-text-price") ||
    context.includes("priceblock_strikeprice") ||
    context.includes("priceblock_ourprice_strike") ||
    context.includes("priceblock_dealprice_strike") ||
    context.includes("priceblock_saleprice_strike") ||
    context.includes("strikeprice") ||
    context.includes("data-a-strike")
  );
}

function isSecondaryPriceContext(html: string, idx: number) {
  const windowStart = Math.max(0, idx - 80);
  const windowEnd = Math.min(html.length, idx + 80);
  const context = html.slice(windowStart, windowEnd).toLowerCase();
  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`).test(context);
  return (
    hasWord("used") ||
    context.includes("used & new") ||
    context.includes("new & used") ||
    context.includes("pre-owned") ||
    context.includes("preowned") ||
    hasWord("refurbished") ||
    hasWord("renewed") ||
    hasWord("rental") ||
    context.includes("for rent") ||
    context.includes("other sellers") ||
    context.includes("more buying choices") ||
    context.includes("from other sellers") ||
    context.includes("used from") ||
    context.includes("new from")
  );
}

function isPromoContext(html: string, idx: number) {
  const windowStart = Math.max(0, idx - 40);
  const windowEnd = Math.min(html.length, idx + 40);
  const context = html.slice(windowStart, windowEnd).toLowerCase();
  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`).test(context);
  return (
    hasWord("off") ||
    hasWord("save") ||
    hasWord("coupon") ||
    hasWord("reward") ||
    hasWord("savings") ||
    hasWord("discount") ||
    hasWord("promo")
  );
}

function shouldExcludePriceCandidate(
  html: string,
  idx: number,
  opts?: { includePromo?: boolean }
) {
  if (isUnitPriceContext(html, idx)) return true;
  if (isInstallmentContext(html, idx)) return true;
  if (isListPriceContext(html, idx)) return true;
  if (isSecondaryPriceContext(html, idx)) return true;
  if (opts?.includePromo && isPromoContext(html, idx)) return true;
  return false;
}

function collectHtmlPriceCandidates(html: string): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  const patterns: Array<{ re: RegExp; score: number; source: string; includePromo?: boolean }> = [
    { re: /id=["']priceblock_ourprice["'][^>]*>\s*([^<]+)/gi, score: 98, source: "priceblock_ourprice" },
    { re: /id=["']priceblock_dealprice["'][^>]*>\s*([^<]+)/gi, score: 98, source: "priceblock_dealprice" },
    { re: /id=["']priceblock_saleprice["'][^>]*>\s*([^<]+)/gi, score: 95, source: "priceblock_saleprice" },
    {
      re: /id=["']priceblock_pospromoprice["'][^>]*>\s*([^<]+)/gi,
      score: 92,
      source: "priceblock_pospromoprice",
    },
    {
      re: /class=["'][^"']*apexPriceToPay[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)/gi,
      score: 90,
      source: "apexPriceToPay",
    },
    {
      re: /id=["']corePriceDisplay[^"']*["'][^>]*>[\s\S]*?class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)/gi,
      score: 88,
      source: "corePriceDisplay",
    },
    {
      re: /itemprop=["']price["'][^>]*content=["']([^"']+)["']/gi,
      score: 85,
      source: "itemprop-price",
    },
    {
      re: /itemprop=["']price["'][^>]*>\s*([^<]+)/gi,
      score: 80,
      source: "itemprop-price-text",
    },
    {
      re: /"priceToPay"\s*:\s*\{[^}]*"value"\s*:\s*"?(\d+(?:\.\d+)?)"?/gi,
      score: 82,
      source: "priceToPay",
    },
    { re: /"price"\s*:\s*"(\d+(?:\.\d+)?)"/gi, score: 55, source: "json-price" },
    {
      re: /class=["'][^"']*a-price[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)/gi,
      score: 60,
      source: "a-price-offscreen",
    },
  ];

  for (const { re, score, source, includePromo } of patterns) {
    for (const m of html.matchAll(re)) {
      if (!m?.[1]) continue;
      const idx = m.index ?? 0;
      if (shouldExcludePriceCandidate(html, idx, { includePromo })) {
        continue;
      }
      addPriceCandidate(candidates, m[1], score, source);
    }
  }

  for (const m of html.matchAll(/class=["']a-price-whole["']>\s*([\d,.]+)/gi)) {
    if (!m?.[1]) continue;
    const idx = m.index ?? 0;
    if (shouldExcludePriceCandidate(html, idx, { includePromo: true })) continue;
    const fractionMatch = html.slice(idx, idx + 120).match(/class=["']a-price-fraction["']>\s*(\d{2})/i);
    const frac = fractionMatch?.[1] ?? "00";
    addPriceCandidate(candidates, `${m[1]}.${frac}`, 58, "a-price-whole");
  }

  for (const m of html.matchAll(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g)) {
    if (!m?.[1]) continue;
    const idx = m.index ?? 0;
    if (shouldExcludePriceCandidate(html, idx, { includePromo: true })) {
      continue;
    }
    addPriceCandidate(candidates, m[1], 35, "usd-text");
  }

  return candidates;
}

function parseAmazonLikeHtml(
  html: string,
  msrpCents: number | null
): { priceCents: number | null; inStock: boolean | null; priceSource: string | null } {
  const ld = extractJsonLd(html);
  const { candidates: ldCandidates, availability } = collectLdCandidates(ld);
  const htmlCandidates = collectHtmlPriceCandidates(html);
  const best = pickBestCandidate([...ldCandidates, ...htmlCandidates], msrpCents);
  const priceCents = best?.cents ?? null;

  const htmlAvailability = extractAvailabilityFromHtml(html);
  const inStock = availabilityToInStock(availability) ?? htmlAvailability ?? (priceCents != null ? true : null);

  return { priceCents, inStock, priceSource: best?.source ?? null };
}

async function refreshOne(input: RefreshInput): Promise<RefreshResult> {
  const { setId, amazonUrl } = input;

  console.log(`[AMAZON_REFRESH] start setId=${setId}`);

  const normalized = normalizeAmazonUrl(amazonUrl);
  if (!normalized.url) {
    console.warn(
      `[AMAZON_REFRESH] skip setId=${setId} reason=${normalized.error ?? "invalid url"}`
    );
    return {
      setId,
      ok: false,
      amazonUrl: amazonUrl ?? null,
      priceCents: null,
      inStock: null,
      error: normalized.error ?? "Invalid amazonUrl",
    };
  }

  const fetchUrl = normalized.url;

  let html = "";
  try {
    const res = await fetch(fetchUrl, {
      redirect: "follow",
      headers: {
        "user-agent": UA,
        "accept-language": "en-US,en;q=0.9",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(
        `[AMAZON_REFRESH] fetch failed setId=${setId} status=${res.status}`
      );
      return {
        setId,
        ok: false,
        amazonUrl: fetchUrl,
        priceCents: null,
        inStock: null,
        error: `Amazon fetch failed: ${res.status}`,
      };
    }

    html = await res.text();
  } catch (err: any) {
    return {
      setId,
      ok: false,
      amazonUrl: fetchUrl,
      priceCents: null,
      inStock: null,
      error: err?.message ?? String(err),
    };
  }

  const identity = await resolveSetIdentityFromAmazonHtml(html);
  const imageUrl = extractAmazonImageUrl(html);
  const currentIsNumeric = isLikelySetId(setId);
  const remapTo =
    !currentIsNumeric && identity.setId && identity.setId !== setId ? identity.setId : null;

  let effectiveSetId = setId;
  if (remapTo) {
    await ensureSetExists(remapTo, identity.name ?? null);
    await prisma.offer
      .delete({
        where: { setIdRef_retailer: { setIdRef: setId, retailer: AMAZON_RETAILER } },
      })
      .catch(() => null);
    await prisma.priceHistory.updateMany({
      where: { setIdRef: setId, retailer: AMAZON_RETAILER },
      data: { setIdRef: remapTo },
    });
    effectiveSetId = remapTo;
    console.log(`[AMAZON_REFRESH] remap setId=${setId} -> ${remapTo}`);
  }

  await updateSetImageIfPlaceholder(effectiveSetId, imageUrl);

  const msrpCents = await getSetMsrpCents(effectiveSetId);
  const { priceCents, inStock, priceSource } = parseAmazonLikeHtml(html, msrpCents);

  console.log(
    `[AMAZON_REFRESH] parsed setId=${effectiveSetId} priceCents=${priceCents ?? "null"} inStock=${
      inStock ?? "null"
    } source=${priceSource ?? "unknown"}`
  );

  await prisma.offer.upsert({
    where: { setIdRef_retailer: { setIdRef: effectiveSetId, retailer: AMAZON_RETAILER } },
    update: {
      price: priceCents,
      inStock,
      updatedAt: new Date(),
      url: fetchUrl,
    },
    create: {
      setIdRef: effectiveSetId,
      retailer: AMAZON_RETAILER,
      url: fetchUrl,
      price: priceCents,
      inStock,
    },
  });

  const last = await prisma.priceHistory.findFirst({
    where: { setIdRef: effectiveSetId, retailer: AMAZON_RETAILER },
    orderBy: { recordedAt: "desc" },
  });

  const changed = last?.price !== priceCents || last?.inStock !== inStock;

  if (changed) {
    await prisma.priceHistory.create({
      data: {
        setIdRef: effectiveSetId,
        retailer: AMAZON_RETAILER,
        price: priceCents,
        inStock,
      },
    });
  }

  console.log(`[AMAZON_REFRESH] done setId=${effectiveSetId}`);
  return { setId: effectiveSetId, ok: true, amazonUrl: fetchUrl, priceCents, inStock };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function refreshAmazonSet(setId: string): Promise<RefreshResult> {
  const offer = await prisma.offer.findUnique({
    where: { setIdRef_retailer: { setIdRef: setId, retailer: AMAZON_RETAILER } },
    select: { url: true },
  });

  const amazonUrl = offer?.url ?? getAmazonSitestripeUrl(setId);
  if (!amazonUrl) {
    return {
      setId,
      ok: false,
      amazonUrl: null,
      priceCents: null,
      inStock: null,
      error: "No amazonUrl stored for this setId",
    };
  }

  return refreshOne({ setId, amazonUrl });
}

export async function refreshAmazonAll(params: { limit: number; take: number }): Promise<RefreshAllResult> {
  const { limit, take } = params;

  try {
    const sets = await prisma.set.findMany({
      orderBy: { setId: "asc" },
      ...(take > 0 ? { take } : {}),
      select: { setId: true },
    });

    const offers = await prisma.offer.findMany({
      where: { retailer: AMAZON_RETAILER },
      select: { setIdRef: true, url: true },
    });

    const urlBySetId = new Map<string, string>();
    for (const o of offers ?? []) {
      const key = String(o?.setIdRef ?? "").trim();
      const url = String(o?.url ?? "").trim();
      if (!key || !url) continue;
      if (!urlBySetId.has(key)) urlBySetId.set(key, url);
    }

    const setInputs: RefreshInput[] = [];
    for (const s of sets ?? []) {
      const setIdRef = String(s?.setId ?? "").trim();
      if (!setIdRef) continue;
      const url = urlBySetId.get(setIdRef) ?? getAmazonSitestripeUrl(setIdRef);
      if (!url) continue;
      setInputs.push({ setId: setIdRef, amazonUrl: url });
    }

    console.log(
      `[AMAZON_REFRESH] bulk start total=${setInputs.length} limit=${limit} take=${take}`
    );
    const results = await mapLimit(setInputs, limit, refreshOne);

    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;

    console.log(
      `[AMAZON_REFRESH] bulk done refreshed=${ok} failed=${failed} total=${results.length}`
    );

    return {
      ok: true,
      total: results.length,
      refreshed: ok,
      failed,
      results,
    };
  } catch (err: any) {
    console.error("[AMAZON_REFRESH] bulk error", err);
    return {
      ok: false,
      total: 0,
      refreshed: 0,
      failed: 0,
      results: [],
      error: err?.message ?? String(err),
    };
  }
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const setId = (searchParams.get("setId") ?? "").trim();
  const refreshAll = ["1", "true", "yes"].includes(
    String(searchParams.get("all") ?? "").toLowerCase()
  );

  if (setId) {
    const result = await refreshAmazonSet(setId);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "Refresh failed",
          setId: result.setId,
          amazonUrl: result.amazonUrl,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      setId: result.setId,
      amazonUrl: result.amazonUrl,
      priceCents: result.priceCents,
      inStock: result.inStock,
    });
  }

  if (!refreshAll) {
    return NextResponse.json(
      { ok: false, error: "Missing setId (for single refresh) or all=1 (for full refresh)" },
      { status: 400 }
    );
  }

  const limitRaw = Number(searchParams.get("limit") ?? 2);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(10, Math.floor(limitRaw)))
    : 2;

  const takeRaw = Number(searchParams.get("take") ?? 0);
  const take = Number.isFinite(takeRaw) ? Math.max(0, Math.floor(takeRaw)) : 0;

  const bulk = await refreshAmazonAll({ limit, take });
  const status = bulk.ok ? 200 : 502;
  return NextResponse.json(bulk, { status });
}

export async function GET(req: Request) {
  return POST(req);
}
