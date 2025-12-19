// app/out/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const u = searchParams.get("u");
  const setId = searchParams.get("setId");
  const retailer = searchParams.get("retailer");

  if (!u) return NextResponse.redirect(new URL("/", req.url));

  if (setId && retailer) {
    try {
      // Only track if set exists (prevents FK issues)
      const exists = await prisma.set.findUnique({
        where: { setId },
        select: { setId: true },
      });

      if (exists) {
        await prisma.click.upsert({
          where: {
            setIdRef_retailer: {
              setIdRef: setId, // ✅ lego number (Set.setId)
              retailer,
            },
          },
          update: { count: { increment: 1 } },
          create: { setIdRef: setId, retailer, count: 1 },
        });
      }
    } catch (e) {
      console.error("[OUT_CLICK_DB_ERROR]", e);
    }
  }

  return NextResponse.redirect(u);
}