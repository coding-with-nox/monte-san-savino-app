import type { Config } from "drizzle-kit";

export default {
  schema: "./src/**/infra/persistence/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.PG_HOST ?? "localhost",
    port: Number(process.env.PG_PORT ?? "5432"),
    user: process.env.PG_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? "postgres",
    database: process.env.PG_DB ?? "tenant_db_1",
    ssl: false
  }
} satisfies Config;
