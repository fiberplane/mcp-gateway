import type { Config } from "drizzle-kit";

export default {
  schema: "./src/logs/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:./drizzle/dev.db", // Not used for actual DB, just for migration generation
  },
} satisfies Config;
