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
  const setId = searchParams.get("setId");

  const store = getStore();

  // return all counts (optionally filter by setId)
  const obj: Record<string, number> = {};
  for (const [key, val] of store.entries()) {
    if (!setId || key.startsWith(`${setId}::`)) obj[key] = val;
  }

  return NextResponse.json(obj);
}