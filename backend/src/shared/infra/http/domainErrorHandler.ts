import { Elysia } from "elysia";
import { isDomainError } from "../../../contest/domain/errors";

/** Extracts a Postgres SQLSTATE code, also through drizzle's `cause` wrapping. */
function pgCode(err: any): string | undefined {
  return err?.code && /^[0-9A-Z]{5}$/.test(String(err.code)) ? String(err.code) : err?.cause?.code;
}

/**
 * Translates a thrown error into an HTTP response, or returns null if it is not one we handle:
 *  - typed domain errors => their own status (404/403/409/...), body { error, code, ...details }
 *  - Postgres unique_violation (23505) => 409
 */
export function mapErrorToResponse(err: unknown): { status: number; body: Record<string, unknown> } | null {
  if (isDomainError(err)) {
    return { status: err.status, body: { error: err.message, code: err.code, ...err.details } };
  }
  if (pgCode(err) === "23505") {
    return { status: 409, body: { error: "Resource already exists", code: "DUPLICATE" } };
  }
  return null;
}

/** Plug into a route group with `.use(domainErrorHandler)`. Unknown errors keep the default behaviour. */
export const domainErrorHandler = new Elysia({ name: "domain-error-handler" })
  .onError({ as: "scoped" }, ({ error, set }) => {
    const mapped = mapErrorToResponse(error);
    if (!mapped) return;
    set.status = mapped.status;
    return mapped.body;
  });
