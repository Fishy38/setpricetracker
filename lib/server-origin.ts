import { headers } from "next/headers";

async function getServerOrigin() {
  const h = await headers();

  const xForwardedHost = h.get("x-forwarded-host");
  const host = xForwardedHost ?? h.get("host");

  const proto = h.get("x-forwarded-proto") ?? "https";

  if (!host) {
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
  }

  return `${proto}://${host}`;
}