// app/api/admin/fetch-rakuten/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchRakutenProducts } from "@/lib/rakuten/fetchProducts";

export async function GET() {
  try {
    const products = await fetchRakutenProducts("lego", 10);
    return NextResponse.json({ ok: true, count: products.length, products });
  } catch (error) {
    console.error("❌ Failed to fetch Rakuten products:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch Rakuten products" },
      { status: 500 }
    );
  }
}