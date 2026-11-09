/** Authorization scope of a judge, derived from judge_assignments. Managers/admins are exempt. */
export type JudgeAssignment = { eventId: string; categoryId: string | null };

export type JudgeScope = { privileged: true } | { privileged: false; assignments: JudgeAssignment[] };

export function buildJudgeScope(role: string | undefined, assignments: JudgeAssignment[]): JudgeScope {
  if (role === "admin" || role === "manager") return { privileged: true };
  return { privileged: false, assignments };
}

/** An assignment with categoryId = null covers the whole event. */
export function canAccessCategory(scope: JudgeScope, category: { id: string; eventId: string }): boolean {
  if (scope.privileged) return true;
  return scope.assignments.some(
    (a) => a.eventId === category.eventId && (a.categoryId === null || a.categoryId === category.id)
  );
}

export type ParticipantModel = { categoryId: string; eventId: string; displayNumber: number | null };

/**
 * What a judge may see of a participant: only display name and exhibitor number, and only if the
 * participant has at least one model in a category the judge can access (optionally narrowed to
 * `categoryId`). Returns null when not visible (route answers 404, not 403, to avoid user probing).
 */
export function participantView(
  scope: JudgeScope,
  models: ParticipantModel[],
  profile: { firstName?: string | null; lastName?: string | null } | null,
  categoryId?: string
): { displayName: string | null; displayNumber: number | null } | null {
  const visible = models.filter(
    (m) => (!categoryId || m.categoryId === categoryId) && canAccessCategory(scope, { id: m.categoryId, eventId: m.eventId })
  );
  if (!visible.length) return null;
  const numbers = visible.map((m) => m.displayNumber).filter((n): n is number => n !== null && n !== undefined);
  const name = [profile?.firstName, profile?.lastName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  return { displayName: name || null, displayNumber: numbers.length ? Math.min(...numbers) : null };
}
