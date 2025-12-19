import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// 👇 Add this global type declaration to make TS happy
declare global {
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg(
  new Pool({ connectionString: process.env.DATABASE_URL })
);

export const prisma = globalThis.prisma ?? new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}