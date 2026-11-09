// Set env vars BEFORE importing buildApp so tenantMiddleware and JwtTokenService
// pick them up from the module-level environment.
process.env.PG_DB = "tenant_db_test";
process.env.PG_HOST ??= "localhost";
process.env.PG_PORT ??= "5432";
process.env.PG_USER ??= "postgres";
process.env.PG_PASSWORD ??= "postgres";
process.env.JWT_SECRET ??= "integration-test-secret-0123456789abcdef";
process.env.RATE_LIMIT_ENABLED ??= "false";

import { buildApp } from "../bootstrap/app";

/** Minimal shape needed by the helpers (avoids TS2589 from ReturnType<typeof buildApp>). */
export interface Handler {
  handle(req: Request): Promise<Response>;
}

export function buildTestApp() {
  return buildApp();
}

export async function postJson(
  app: Handler,
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
  app: Handler,
  path: string,
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return app.handle(
    new Request(`http://localhost${path}`, { method: "GET", headers })
  );
}
