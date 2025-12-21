// prisma.config.ts (PROJECT ROOT)
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // If you later add an unpooled Neon URL, you can also do:
    // directUrl: env("DATABASE_URL_UNPOOLED"),
  },
});