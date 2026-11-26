/**
 * Who has to vote which model (pure rules, no I/O).
 *
 *  - A REGULAR judge covers a category with an assignment without standingIn (event-wide or category-specific).
 *  - A STAND-IN judge covers one category with an assignment with standingIn = true.
 *  - A judge never votes a model he owns.
 *  - Expected voters of a model owned by U (category C): regular judges of C minus U; if U is himself a
 *    regular judge of C, also the stand-in judges of C minus U.
 */

export type JudgeAssignmentRow = { judgeId: string; eventId: string; categoryId: string | null; standingIn: boolean };
export type CategoryRef = { id: string; eventId: string };

const unique = (ids: string[]) => [...new Set(ids)];

const coversCategory = (a: JudgeAssignmentRow, category: CategoryRef) =>
  a.eventId === category.eventId && (a.categoryId === null || a.categoryId === category.id);

/** Regular (non stand-in) judges covering the category, directly or event-wide. */
export function regularJudgeIds(assignments: JudgeAssignmentRow[], category: CategoryRef): string[] {
  return unique(assignments.filter((a) => !a.standingIn && coversCategory(a, category)).map((a) => a.judgeId));
}

/** Stand-in judges of the category (category-specific assignments only). */
export function standInJudgeIds(assignments: JudgeAssignmentRow[], category: CategoryRef): string[] {
  return unique(
    assignments
      .filter((a) => a.standingIn && a.eventId === category.eventId && a.categoryId === category.id)
      .map((a) => a.judgeId)
  );
}

/** Every judge assigned to the category (regular or stand-in). Zero => nobody can judge it. */
export function assignedJudgeIds(assignments: JudgeAssignmentRow[], category: CategoryRef): string[] {
  return unique(assignments.filter((a) => coversCategory(a, category)).map((a) => a.judgeId));
}

/** Judges that must vote a model of `category` owned by `ownerId`. */
export function expectedVoterIds(assignments: JudgeAssignmentRow[], category: CategoryRef, ownerId: string): string[] {
  const regular = regularJudgeIds(assignments, category);
  const pool = regular.includes(ownerId) ? [...regular, ...standInJudgeIds(assignments, category)] : regular;
  return unique(pool).filter((id) => id !== ownerId);
}

/**
 * Whether a judge may see and vote a model: he must be one of its expected voters.
 * A stand-in therefore only sees models owned by regular judges of the category.
 * Own models are never expected (callers answer OWN_MODEL before asking this).
 */
export function mayVoteModel(assignments: JudgeAssignmentRow[], judgeId: string, category: CategoryRef, ownerId: string): boolean {
  return judgeId !== ownerId && expectedVoterIds(assignments, category, ownerId).includes(judgeId);
}
