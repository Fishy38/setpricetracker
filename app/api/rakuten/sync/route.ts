import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { spawn } = await import("child_process");

  const proc = spawn("pnpm", ["tsx", "scripts/sync-rakuten.ts"], {
    stdio: "inherit",
  });

  return NextResponse.json({ ok: true, message: "Rakuten sync triggered." });
}