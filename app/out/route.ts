// app/out/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Retailer } from "@prisma/client";
import crypto from "crypto";

function coerceRetailer(v: string | null): Retailer | null {
  if (!v) return null;
  const s = v.trim();
  if (s in Retailer) return Retailer[s as keyof typeof Retailer];
  return null;
}

function safeHttpUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

function getFirstIp(req: Request): string {
  const xfwd = req.headers.get("x-forwarded-for") ?? "";
  const first = xfwd.split(",")[0]?.trim();
  return first || "0.0.0.0";
}

function hashIp(ip: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function makeCid(provided: string | null): string {
  const p = (provided ?? "").trim();
  if (p && p.length <= 200) return p;
  return crypto.randomUUID();
}

function ensureRakutenU1(url: URL, cid: string): URL {
  const host = url.hostname.toLowerCase();
  const isRakutenClick =
    host.includes("linksynergy.com") || host.includes("click.linksynergy.com");

  if (!isRakutenClick) return url;

  // only set if absent (don’t clobber an existing u1 you may have set elsewhere)
  if (!url.searchParams.get("u1")) {
    url.searchParams.set("u1", cid);
  }

  return url;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const raw = searchParams.get("u");
  const setId = searchParams.get("setId")?.trim() || null;
  const giftcardId = searchParams.get("giftcardId")?.trim() || null;

  const retailerParam = searchParams.get("retailer");
  const retailerEnum = coerceRetailer(retailerParam);
  const retailerString = retailerParam?.trim() || null;

  const cid = makeCid(searchParams.get("cid"));

  if (!raw) return NextResponse.redirect(new URL("/", req.url));

  const destUrl = safeHttpUrl(raw);
  if (!destUrl) return new NextResponse("Bad redirect URL", { status: 400 });

  const finalUrl = ensureRakutenU1(destUrl, cid);
  const destinationHost = finalUrl.hostname || null;

  // Best-effort tracking (never block redirect)
  try {
    // aggregate click tracking for Set pages (your existing Click table)
    if (setId && retailerEnum) {
      const exists = await prisma.set.findUnique({
        where: { setId },
        select: { setId: true },
      });

      if (exists) {
        await prisma.click.upsert({
          where: {
            setIdRef_retailer: {
              setIdRef: setId,
              retailer: retailerEnum as any,
            },
          },
          update: { count: { increment: 1 } },
          create: { setIdRef: setId, retailer: retailerEnum as any, count: 1 },
        });
      }
    }

    // per-click audit trail
    const ip = getFirstIp(req);
    const ua = req.headers.get("user-agent") ?? null;
    const ref = req.headers.get("referer") ?? null;

    const salt = process.env.CLICK_HASH_SALT || "dev";
    const ipHash = hashIp(ip, salt);

    await prisma.outboundClick.create({
      data: {
        cid,
        setIdRef: setId,
        giftCardRakutenProductId: giftcardId,
        retailer: retailerString,
        destination: finalUrl.toString(),
        destinationHost,
        referrer: ref,
        ua,
        ipHash,
      },
    });
  } catch (e) {
    console.error("[OUT_CLICK_TRACK_ERROR]", e);
  }

  const res = NextResponse.redirect(finalUrl.toString());

  // Persist cid (optional, but useful later)
  res.headers.append(
    "Set-Cookie",
    `spt_cid=${encodeURIComponent(cid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );

  return res;
}