import type { Config } from "drizzle-kit";

export default {
  schema: "./src/**/infra/persistence/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    host: process.env.PG_HOST ?? "localhost",
    user: process.env.PG_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? "postgres",
    database: process.env.PG_DB ?? "tenant_db_1"
  }
} satisfies Config;
