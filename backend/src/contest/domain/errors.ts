/**
 * Typed domain errors. They carry the HTTP status they map to so that a single
 * error handler (shared/infra/http/domainErrorHandler.ts) can translate them
 * without each route needing its own try/catch.
 */
export class DomainError extends Error {
  readonly isDomainError = true;
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Not found", details: Record<string, unknown> = {}) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden", details: Record<string, unknown> = {}) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Conflict", details: Record<string, unknown> = {}, code = "CONFLICT") {
    super(message, 409, code, details);
  }
}

export class CategoryClosedError extends ConflictError {
  constructor(message = "Category is closed", details: Record<string, unknown> = {}) {
    super(message, details, "CATEGORY_CLOSED");
  }
}

/** A judge tried to complete a category without having voted every model. */
export class IncompleteVotesError extends ConflictError {
  constructor(public readonly missing: number, public readonly totalModels: number, missingModelIds: string[] = []) {
    super(`Not all models of the category have been voted: ${missing} of ${totalModels} models missing a vote`, { missing, totalModels, missingModelIds }, "INCOMPLETE_VOTES");
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return Boolean(err) && typeof err === "object" && (err as any).isDomainError === true;
}
