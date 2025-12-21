// app/api/cron/daily/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function getBaseUrl() {
  // Prefer explicit site URL if set
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel provides VERCEL_URL without protocol
  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

type HitResult = {
  ok: boolean;
  path: string;
  method: string;
  status: number;
  ms: number;
  body?: any;
  text?: string;
};

async function hit(opts: {
  base: string;
  path: string;
  method?: "GET" | "POST";
  timeoutMs?: number;
}) : Promise<HitResult> {
  const { base, path, method = "POST", timeoutMs = 120_000 } = opts;

  const url = `${base}${path}`;
  const started = Date.now();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "x-cron-key": process.env.CRON_SECRET || "",
        // Make intent explicit
        "content-type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const ms = Date.now() - started;

    const contentType = res.headers.get("content-type") || "";
    let body: any = undefined;
    let text: string | undefined = undefined;

    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => undefined);
    } else {
      text = await res.text().catch(() => undefined);
    }

    if (!res.ok) {
      return {
        ok: false,
        path,
        method,
        status: res.status,
        ms,
        body,
        text,
      };
    }

    return {
      ok: true,
      path,
      method,
      status: res.status,
      ms,
      body,
      text,
    };
  } catch (err: any) {
    const ms = Date.now() - started;
    const msg =
      err?.name === "AbortError"
        ? `Timeout after ${timeoutMs}ms`
        : err?.message ?? String(err);

    return {
      ok: false,
      path,
      method,
      status: 0,
      ms,
      text: msg,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const base = getBaseUrl();
  const started = Date.now();

  // If you want: run LEGO refresh for *all* sets daily.
  // This is usually what you mean by "update commands once every 24 hours".
  const jobs = [
    // LEGO full refresh (use lego-all, NOT per-set lego route)
    { name: "legoAll", path: "/api/refresh/lego-all?limit=2", method: "POST" as const, timeoutMs: 300_000 },

    // Giftcards refresh (purge=1 keeps DB clean; remove if you dislike)
    { name: "giftcards", path: "/api/refresh/giftcards?purge=1", method: "POST" as const, timeoutMs: 180_000 },

    // Rakuten refresh endpoint currently uses GET in your code
    { name: "rakuten", path: "/api/admin/rakuten-refresh", method: "GET" as const, timeoutMs: 60_000 },
  ];

  const results: Record<string, HitResult> = {};

  // Run sequentially (safer; avoids hammering DB / external sites at once)
  for (const j of jobs) {
    results[j.name] = await hit({
      base,
      path: j.path,
      method: j.method,
      timeoutMs: j.timeoutMs,
    });

    // If a job fails, stop immediately (so you notice)
    if (!results[j.name].ok) {
      console.error("[CRON_DAILY_FAIL]", {
        base,
        job: j.name,
        result: results[j.name],
      });

      return NextResponse.json(
        {
          ok: false,
          base,
          ranAt: new Date().toISOString(),
          totalMs: Date.now() - started,
          failedJob: j.name,
          results,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    base,
    ranAt: new Date().toISOString(),
    totalMs: Date.now() - started,
    results,
  });
}