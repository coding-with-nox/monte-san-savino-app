import { getTenantDb } from "../tenancy/infra/tenantDbFactory";
import { usersTable } from "../identity/infra/persistence/schema";

export function getTestDb() {
  return getTenantDb({
    host: process.env.PG_HOST ?? "localhost",
    port: Number(process.env.PG_PORT ?? "5432"),
    database: "tenant_db_test",
    user: process.env.PG_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? "postgres",
  });
}

export async function truncateUsers() {
  const db = getTestDb();
  await db.delete(usersTable);
}
