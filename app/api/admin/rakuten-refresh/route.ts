export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { spawn } = await import("child_process");

    const child = spawn("npx", ["tsx", "scripts/sync-rakuten.ts"], {
      stdio: "inherit",
      shell: true,
    });

    return NextResponse.json({ ok: true, message: "Rakuten sync started." });
  } catch (err: any) {
    console.error("❌ Failed to trigger sync script:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}