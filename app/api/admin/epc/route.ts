// app/api/admin/epc/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/epc?days=30
 * Returns per-retailer clicks, conversions, commission, and EPC (commission/click).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const daysRaw = Number(searchParams.get("days") ?? 30);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, Math.floor(daysRaw))) : 30;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // clicks grouped by retailer
  const clicks = await prisma.outboundClick.groupBy({
    by: ["retailer"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  // conversions grouped by retailer (via relation click.retailer)
  const convs = await prisma.affiliateConversion.findMany({
    where: { occurredAt: { gte: since } },
    select: {
      commissionCents: true,
      click: { select: { retailer: true } },
    },
  });

  const byRetailer: Record<
    string,
    { clicks: number; conversions: number; commissionCents: number }
  > = {};

  for (const c of clicks) {
    const key = c.retailer ?? "Unknown";
    byRetailer[key] = byRetailer[key] || { clicks: 0, conversions: 0, commissionCents: 0 };
    byRetailer[key].clicks += c._count._all;
  }

  for (const r of convs) {
    const key = r.click?.retailer ?? "Unknown";
    byRetailer[key] = byRetailer[key] || { clicks: 0, conversions: 0, commissionCents: 0 };
    byRetailer[key].conversions += 1;
    byRetailer[key].commissionCents += r.commissionCents ?? 0;
  }

  const rows = Object.entries(byRetailer)
    .map(([retailer, v]) => {
      const epc = v.clicks > 0 ? v.commissionCents / v.clicks : 0;
      return {
        retailer,
        clicks: v.clicks,
        conversions: v.conversions,
        commissionCents: v.commissionCents,
        epcCents: Math.round(epc),
      };
    })
    .sort((a, b) => b.epcCents - a.epcCents);

  return NextResponse.json({
    ok: true,
    days,
    since: since.toISOString(),
    rows,
  });
}

/**
 * POST /api/admin/epc
 * Body example:
 * {
 *   "cid": "uuid-from-outbound-click",
 *   "commissionCents": 123,
 *   "saleAmountCents": 4999,
 *   "occurredAt": "2025-12-21T00:00:00.000Z"
 * }
 *
 * This is the bridge until you automate Rakuten report import.
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, any> = {};

  if (contentType.includes("application/json")) {
    body = await req.json().catch(() => ({} as any));
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await req.formData().catch(() => null);
    if (form) {
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") body[key] = value;
      }
    }
  } else {
    body = await req.json().catch(() => ({} as any));
  }

  const cid = typeof body?.cid === "string" ? body.cid.trim() : "";
  const toNumberOrNull = (v: unknown) => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = typeof v === "number" ? v : Number(String(v));
    return Number.isFinite(n) ? n : null;
  };

  const commissionCents = toNumberOrNull(body?.commissionCents) ?? 0;
  const saleAmountCents = toNumberOrNull(body?.saleAmountCents);
  const occurredAt = body?.occurredAt ? new Date(body.occurredAt) : new Date();

  if (!cid) {
    return NextResponse.json({ ok: false, error: "Missing cid" }, { status: 400 });
  }

  // ensure click exists
  const click = await prisma.outboundClick.findUnique({ where: { cid }, select: { cid: true } });
  if (!click) {
    return NextResponse.json({ ok: false, error: "cid not found in outbound clicks" }, { status: 404 });
  }

  const row = await prisma.affiliateConversion.upsert({
    where: { cid },
    update: {
      commissionCents: Math.max(0, Math.trunc(commissionCents)),
      saleAmountCents: saleAmountCents == null ? null : Math.max(0, Math.trunc(saleAmountCents)),
      occurredAt,
      network: "rakuten",
    },
    create: {
      cid,
      commissionCents: Math.max(0, Math.trunc(commissionCents)),
      saleAmountCents: saleAmountCents == null ? null : Math.max(0, Math.trunc(saleAmountCents)),
      occurredAt,
      network: "rakuten",
    },
  });

  return NextResponse.json({ ok: true, row });
}
