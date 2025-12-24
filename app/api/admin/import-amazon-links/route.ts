import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AMAZON_HOST_RE = /(^|\.)amazon\.[a-z.]+$/i;
const PLACEHOLDER_IMAGE = "/placeholder-set.svg";

type ParsedLink = {
  url: string;
  setId: string;
  name: string;
};

function isAmazonHost(host: string) {
  return AMAZON_HOST_RE.test(host);
}

function parseSetIdFromSlug(slug: string) {
  const matches = slug.match(/\b\d{4,6}\b/g) ?? [];
  if (!matches.length) return null;
  return (
    matches.find((m) => m.length === 5) ??
    matches.find((m) => m.length === 4) ??
    matches.find((m) => m.length === 6) ??
    matches[0] ??
    null
  );
}

function parseAsinFromPath(pathname: string) {
  const m = pathname.match(/\/dp\/([A-Z0-9]{10})/i);
  return m?.[1] ?? null;
}

function titleFromSlug(slug: string) {
  const clean = slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "LEGO Set";
  return clean.replace(/^lego\s+/i, "LEGO ");
}

function parseAmazonUrl(raw: string): ParsedLink | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!isAmazonHost(parsed.hostname)) return null;

  const path = parsed.pathname || "";
  const slugPath = path.split("/dp/")[0] || path;
  const slug = slugPath.split("/").filter(Boolean).slice(-1)[0] ?? "";
  const setId = parseSetIdFromSlug(slug) ?? parseAsinFromPath(path);
  if (!setId) return null;

  const name = titleFromSlug(decodeURIComponent(slug));

  return { url: parsed.toString(), setId, name };
}

async function readBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { links?: string | string[] };
    const links = body?.links ?? "";
    return Array.isArray(links) ? links.join("\n") : String(links);
  }

  const form = await req.formData();
  return String(form.get("links") ?? "");
}

function splitLinks(raw: string) {
  return String(raw ?? "")
    .split(/\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const body = await readBody(req);
  const rawLinks = splitLinks(body);

  const parsed: ParsedLink[] = [];
  const skipped: { url: string; reason: string }[] = [];
  const seenSetIds = new Set<string>();

  for (const raw of rawLinks) {
    const item = parseAmazonUrl(raw);
    if (!item) {
      skipped.push({ url: raw, reason: "invalid or missing setId" });
      continue;
    }
    if (seenSetIds.has(item.setId)) {
      skipped.push({ url: raw, reason: "duplicate setId in batch" });
      continue;
    }
    seenSetIds.add(item.setId);
    parsed.push(item);
  }

  if (!parsed.length) {
    return NextResponse.json({ ok: false, error: "No valid links", skipped }, { status: 400 });
  }

  const setIds = parsed.map((p) => p.setId);
  const existing = await prisma.set.findMany({
    where: { setId: { in: setIds } },
    select: { setId: true, name: true },
  });
  const existingIds = new Set(existing.map((s) => s.setId));

  let created = 0;
  let updated = 0;

  for (const item of parsed) {
    if (!existingIds.has(item.setId)) {
      await prisma.set.create({
        data: {
          setId: item.setId,
          name: item.name,
          imageUrl: PLACEHOLDER_IMAGE,
        },
      });
      created += 1;
    }

    await prisma.offer.upsert({
      where: { setIdRef_retailer: { setIdRef: item.setId, retailer: "Amazon" } },
      update: {
        url: item.url,
        updatedAt: new Date(),
      },
      create: {
        setIdRef: item.setId,
        retailer: "Amazon",
        url: item.url,
        price: null,
        inStock: null,
      },
    });

    updated += 1;
  }

  return NextResponse.json({
    ok: true,
    received: rawLinks.length,
    imported: parsed.length,
    created,
    updated,
    skipped,
  });
}
