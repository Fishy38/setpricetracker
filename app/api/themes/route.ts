import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await prisma.set.findMany({
    select: { name: true },
  });

  const counts: Record<string, number> = {};

  for (const r of rows) {
    const name = r.name?.toLowerCase() ?? "";
    if (name.includes("star wars")) counts["star-wars"] = (counts["star-wars"] ?? 0) + 1;
    if (name.includes("disney")) counts["disney"] = (counts["disney"] ?? 0) + 1;
    if (name.includes("technic")) counts["technic"] = (counts["technic"] ?? 0) + 1;
    if (name.includes("city")) counts["city"] = (counts["city"] ?? 0) + 1;
    if (name.includes("creator")) counts["creator"] = (counts["creator"] ?? 0) + 1;
  }

  const themes = Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([slug]) => ({
      slug,
      name: slug.replace("-", " ").toUpperCase(),
      count: counts[slug],
    }));

  return NextResponse.json(themes);
}