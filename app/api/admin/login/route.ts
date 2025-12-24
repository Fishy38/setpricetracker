import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  getAdminAuthConfig,
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
} from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readCredentials(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
      next?: string;
    };
    return {
      username: String(body?.username ?? "").trim(),
      password: String(body?.password ?? "").trim(),
      next: String(body?.next ?? "").trim(),
    };
  }

  const form = await req.formData();
  return {
    username: String(form.get("username") ?? "").trim(),
    password: String(form.get("password") ?? "").trim(),
    next: String(form.get("next") ?? "").trim(),
  };
}

function safeNextPath(raw: string) {
  if (!raw) return "/admin";
  if (!raw.startsWith("/admin")) return "/admin";
  return raw;
}

export async function POST(req: Request) {
  const config = getAdminAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Admin auth not configured" }, { status: 500 });
  }

  const { username, password, next } = await readCredentials(req);
  const ok = username === config.username && password === config.password;

  if (!ok) {
    const url = new URL("/admin/login?error=1", req.url);
    return NextResponse.redirect(url, { status: 302 });
  }

  const token = await createAdminSessionToken(username);
  const res = NextResponse.redirect(new URL(safeNextPath(next), req.url), {
    status: 302,
  });

  res.cookies.set(getAdminSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminSessionMaxAgeSeconds(),
  });

  return res;
}
