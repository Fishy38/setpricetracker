// scripts/reclassify-merch-parts.ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase();
}

const merchKeywords = [
  "t-shirt",
  "t shirt",
  "tee",
  "hoodie",
  "sweatshirt",
  "sweater",
  "jacket",
  "coat",
  "pants",
  "shorts",
  "leggings",
  "pajama",
  "sleepwear",
  "shirt",
  "jersey",
  "hat",
  "cap",
  "beanie",
  "scarf",
  "gloves",
  "socks",
  "backpack",
  "bag",
  "tote",
  "lunchbox",
  "water bottle",
  "keychain",
  "key chain",
  "wallet",
  "sticker",
  "mug",
  "cup",
  "blanket",
  "poster",
  "book",
];

const partsKeywords = [
  "motor",
  "servo",
  "hub",
  "battery",
  "battery box",
  "rechargeable",
  "charger",
  "cable",
  "wire",
  "remote",
  "controller",
  "sensor",
  "light",
  "led",
  "power functions",
  "powered up",
  "train motor",
];

function includesAny(hay: string, kws: string[]) {
  return kws.some((k) => hay.includes(k));
}

async function main() {
  // Only touch non-set rows (setNumber null) to avoid messing with real sets
  const rows = await prisma.set.findMany({
    where: {
      setNumber: null,
      // we mainly need to fix stuff currently tagged PARTS/OTHER
      productType: { in: ["PARTS", "OTHER"] },
    },
    select: { setId: true, name: true, productType: true },
    take: 200000,
  });

  let toMerch = 0;
  let toParts = 0;
  let unchanged = 0;

  for (const r of rows) {
    const hay = norm(r.name);

    const isMerch = includesAny(hay, merchKeywords);
    const isParts = includesAny(hay, partsKeywords);

    // Merch wins if both hit (because clothing is your main pain)
    let next: "MERCH" | "PARTS" | "OTHER" = "OTHER";
    if (isMerch) next = "MERCH";
    else if (isParts) next = "PARTS";

    if (next === r.productType) {
      unchanged++;
      continue;
    }

    await prisma.set.update({
      where: { setId: r.setId },
      data: { productType: next },
    });

    if (next === "MERCH") toMerch++;
    else if (next === "PARTS") toParts++;
  }

  console.log("✅ Reclassify done:", { toMerch, toParts, unchanged, total: rows.length });
}

main()
  .catch((e) => {
    console.error("❌ Reclassify failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });