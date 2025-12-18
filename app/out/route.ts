import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __CLICK_COUNTS__: Map<string, number> | undefined;
}

function getStore() {
  if (!globalThis.__CLICK_COUNTS__) globalThis.__CLICK_COUNTS__ = new Map();
  return globalThis.__CLICK_COUNTS__;
}

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const u = searchParams.get("u");
  const setId = searchParams.get("setId") || "unknown";
  const retailer = searchParams.get("retailer") || "unknown";

  if (!u) return NextResponse.redirect(new URL("/", req.url));

  // ✅ increment click count (beta/in-memory)
  const store = getStore();
  const key = `${setId}::${retailer}`;
  store.set(key, (store.get(key) ?? 0) + 1);

  // ✅ log (still useful)
  console.log("[OUT_CLICK]", {
    setId,
    retailer,
    url: u,
    count: store.get(key),
    ts: new Date().toISOString(),
    ua: req.headers.get("user-agent"),
    ref: req.headers.get("referer"),
  });

  return NextResponse.redirect(u);
}