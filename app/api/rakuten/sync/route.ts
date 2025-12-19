// app/api/rakuten/sync/route.ts
import { NextResponse } from "next/server";
import { refreshLegoProductsWithHistory } from "@/lib/rakuten";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");

  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshLegoProductsWithHistory();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("❌ Rakuten sync failed:", err);
    return NextResponse.json(
      { error: "Failed to sync Rakuten LEGO products", details: err.message },
      { status: 500 }
    );
  }
}