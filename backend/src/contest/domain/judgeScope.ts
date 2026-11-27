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
