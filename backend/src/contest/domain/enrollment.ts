import { DomainError } from "./errors";

export const CLOSED_EVENT_STATUSES = ["closed", "archived", "cancelled", "canceled", "completed"];

export type EnrollmentContext = {
  userId: string;
  role: string | undefined;
  eventId: string;
  event: { id: string; status: string } | null;
  category: { id: string; eventId: string; status: string } | null;
  model: { id: string; userId: string; categoryId: string } | null;
  requested: { modelId?: string | null; categoryId?: string | null };
  /** Result of the campaign window check (true = enrollment period over). */
  windowClosed: boolean;
};

export type EnrollmentPlan = { ownerUserId: string; modelId: string | null; categoryId: string | null };

const isPrivileged = (role?: string) => role === "manager" || role === "admin";

/**
 * Validates an enrollment request. Throws a typed DomainError (404/403/409/422) or returns the
 * normalized values to persist. Managers/admins may enroll any model (the registration is then
 * owned by the model owner) and bypass the enrollment window, like model creation does.
 */
export function planEnrollment(ctx: EnrollmentContext): EnrollmentPlan {
  const privileged = isPrivileged(ctx.role);
  if (!ctx.event) throw new DomainError("Event not found", 404, "NOT_FOUND");
  if (CLOSED_EVENT_STATUSES.includes(String(ctx.event.status).toLowerCase())) {
    throw new DomainError("Event is closed", 409, "EVENT_CLOSED");
  }

  let modelId: string | null = null;
  let ownerUserId = ctx.userId;
  if (ctx.requested.modelId) {
    if (!ctx.model) throw new DomainError("Model not found", 404, "NOT_FOUND");
    if (ctx.model.userId !== ctx.userId && !privileged) {
      // do not disclose existence of other users' models
      throw new DomainError("Model not found", 404, "NOT_FOUND");
    }
    modelId = ctx.model.id;
    ownerUserId = ctx.model.userId;
  }

  let categoryId: string | null = ctx.requested.categoryId ?? null;
  if (modelId && ctx.model) {
    if (categoryId && categoryId !== ctx.model.categoryId) {
      throw new DomainError("categoryId does not match the model category", 422, "CATEGORY_MODEL_MISMATCH");
    }
    categoryId = ctx.model.categoryId;
  }
  if (categoryId) {
    if (!ctx.category) throw new DomainError("Category not found", 422, "INVALID_CATEGORY");
    if (ctx.category.eventId !== ctx.eventId) {
      throw new DomainError("Category does not belong to this event", 422, "CATEGORY_EVENT_MISMATCH");
    }
    if (ctx.category.status === "closed") {
      throw new DomainError("Category is closed", 409, "CATEGORY_CLOSED");
    }
  }

  if (!privileged && ctx.windowClosed) {
    throw new DomainError("Enrollment period is closed", 403, "ENROLLMENT_CLOSED");
  }
  return { ownerUserId, modelId, categoryId };
}
