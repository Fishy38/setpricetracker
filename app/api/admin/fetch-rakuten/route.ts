// app/api/admin/fetch-rakuten/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchRakutenProducts } from "@/lib/rakuten/fetchProducts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") ?? "lego").trim() || "lego";
  const limitRaw = Number(searchParams.get("limit") ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 10;

  try {
    const products = await fetchRakutenProducts(q, limit);
    return NextResponse.json({ ok: true, query: q, count: products.length, products });
  } catch (error: any) {
    console.error("❌ Failed to fetch Rakuten products:", error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Failed to fetch Rakuten products" },
      { status: 500 }
    );
  }
}