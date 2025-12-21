// app/api/clicks/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Retailer } from "@prisma/client";

function coerceRetailer(v: unknown): Retailer | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  // Accept exact enum strings
  if (s in Retailer) return Retailer[s as keyof typeof Retailer];
  return null;
}

// POST /api/clicks  body: { setId: "66802", retailer: "Amazon" }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const setId = typeof body?.setId === "string" ? body.setId.trim() : "";
  const retailer = coerceRetailer(body?.retailer);

  if (!setId || !retailer) {
    return NextResponse.json(
      { ok: false, error: "Missing/invalid setId or retailer" },
      { status: 400 }
    );
  }

  // Ensure Set exists (Click.setIdRef FK references Set.setId)
  const setRow = await prisma.set.findUnique({
    where: { setId },
    select: { setId: true },
  });

  if (!setRow) {
    return NextResponse.json({ ok: false, error: "Set not found" }, { status: 404 });
  }

  await prisma.click.upsert({
    where: {
      setIdRef_retailer: {
        setIdRef: setId,
        retailer,
      },
    },
    update: { count: { increment: 1 } },
    create: {
      setIdRef: setId,
      retailer,
      count: 1,
    },
  });

  return NextResponse.json({ ok: true });
}

// GET /api/clicks?setId=66802  -> { "66802::Amazon": 2, ... }
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const setId = (searchParams.get("setId") ?? "").trim();
  if (!setId) return NextResponse.json({});

  const setRow = await prisma.set.findUnique({
    where: { setId },
    select: { setId: true },
  });
  if (!setRow) return NextResponse.json({});

  const rows = await prisma.click.findMany({
    where: { setIdRef: setId },
    select: { retailer: true, count: true },
  });

  const out: Record<string, number> = {};
  for (const r of rows) out[`${setId}::${r.retailer}`] = r.count;

  return NextResponse.json(out);
}