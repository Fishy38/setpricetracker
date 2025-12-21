// app/category/[slug]/page.tsx
import { notFound } from "next/navigation";
import HomeClient from "@/app/home-client";

const VALID_SLUGS = new Set([
  "all",
  "star-wars",
  "technic",
  "icons",
  "botanicals",
  "city",
  "friends",
  "ninjago",
  "harry-potter",
  "marvel",
  "disney",
  "minecraft",
  "jurassic",
  "speed-champions",
  "architecture",
  "ideas",
  "creator",
  "art",
  "other",
]);

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const s = String(slug || "").toLowerCase();

  // invalid slug => 404
  if (!VALID_SLUGS.has(s)) notFound();

  // "all" should just behave like home
  if (s === "all") {
    return <HomeClient initialCategory="all" />;
  }

  // Ask your API for sets (so this works for DB data too)
  // Use SITE_URL/NEXT_PUBLIC_SITE_URL/VERCEL_URL when available
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL
      ? process.env.VERCEL_URL.startsWith("http")
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const res = await fetch(new URL("/api/sets", base), { cache: "no-store" });
  const rows: any[] = res.ok ? await res.json().catch(() => []) : [];

  // same categorizer logic (server-side) — must match HomeClient
  const categorize = (name: string): string => {
    const n = (name || "").toLowerCase();

    if (n.includes("star wars") || n.includes("mandalorian") || n.includes("jedi"))
      return "star-wars";
    if (n.includes("technic")) return "technic";
    if (n.includes("icons")) return "icons";
    if (
      n.includes("botanical") ||
      n.includes("flower") ||
      n.includes("bouquet") ||
      n.includes("orchid") ||
      n.includes("bonsai") ||
      n.includes("succulent")
    )
      return "botanicals";
    if (n.includes("city")) return "city";
    if (n.includes("friends")) return "friends";
    if (n.includes("ninjago")) return "ninjago";
    if (n.includes("harry potter") || n.includes("hogwarts")) return "harry-potter";
    if (n.includes("marvel") || n.includes("avengers") || n.includes("spider-man"))
      return "marvel";
    if (n.includes("disney") || n.includes("princess") || n.includes("pixar"))
      return "disney";
    if (n.includes("minecraft")) return "minecraft";
    if (n.includes("jurassic") || n.includes("dinosaur")) return "jurassic";
    if (n.includes("speed champions")) return "speed-champions";
    if (n.includes("architecture")) return "architecture";
    if (n.includes("ideas")) return "ideas";
    if (n.includes("creator")) return "creator";
    if (n.includes("art")) return "art";

    return "other";
  };

  const count = (rows || []).filter((r) => categorize(String(r?.name ?? "")) === s).length;

  // empty category => 404 (hidden)
  if (count === 0) notFound();

  return <HomeClient initialCategory={s} />;
}