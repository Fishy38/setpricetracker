// app/api/rakuten/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code from callback" }, { status: 400 });
  }

  console.log("Received OAuth code:", code); // just for dev

  return NextResponse.json({
    message: "Code received successfully!",
    code,
  });
}