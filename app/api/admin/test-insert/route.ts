import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  // ✅ Bypass auth only in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setId = "76445";
    const retailer = "LEGO";

    const inserted = await prisma.priceHistory.create({
      data: {
        setIdRef: setId,
        retailer,
        price: 9999, // $99.99
        inStock: true,
      },
    });

    return NextResponse.json({ ok: true, inserted });
  } catch (err) {
    console.error("❌ Failed to insert test history:", err);
    return NextResponse.json(
      { error: "Failed to insert test price history" },
      { status: 500 }
    );
  }
}