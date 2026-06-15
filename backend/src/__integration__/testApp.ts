// Set env vars BEFORE importing buildApp so tenantMiddleware and JwtTokenService
// pick them up from the module-level environment.
process.env.PG_DB = "tenant_db_test";
process.env.PG_HOST ??= "localhost";
process.env.PG_PORT ??= "5432";
process.env.PG_USER ??= "postgres";
process.env.PG_PASSWORD ??= "postgres";
process.env.JWT_SECRET ??= "test-secret";

import { buildApp } from "../bootstrap/app";

export function buildTestApp() {
  return buildApp();
}

export async function postJson(
  app: ReturnType<typeof buildApp>,
  path: string,
  body: unknown
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function getJson(
  app: ReturnType<typeof buildApp>,
  path: string,
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return app.handle(
    new Request(`http://localhost${path}`, { method: "GET", headers })
  );
}
