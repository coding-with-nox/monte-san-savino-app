/**
 * Pure rules for category completion / closure and award computation.
 * No I/O here: everything is unit-testable without a database.
 */

export type Bracket = { medalLabel: string; medalRank: number; lowLimit: number; highLimit: number };
export type LatestVote = { judgeId: string; modelId: string; rank: number };
export type AwardRow = { modelId: string; totalScore: number; medalLabel: string; medalRank: number };

/**
 * Bracket selection rule (unchanged from the original implementation):
 * a bracket matches when lowLimit <= score <= highLimit (both inclusive).
 * Brackets are allowed to overlap; when several match, the one with the LOWEST
 * medalRank wins (the more conservative medal). No match => "None" / rank 0.
 * Ties on medalRank are resolved by input order (Array.prototype.sort is stable).
 */
export function selectBracket(brackets: Bracket[], totalScore: number): { medalLabel: string; medalRank: number } {
  const match = brackets
    .filter((b) => b.lowLimit <= totalScore && b.highLimit >= totalScore)
    .sort((a, b) => a.medalRank - b.medalRank)[0];
  return { medalLabel: match?.medalLabel ?? "None", medalRank: match?.medalRank ?? 0 };
}

/**
 * Computes the award of each model. `latestVotes` must contain AT MOST the latest vote per
 * (judge, model); only votes of `judgeIds` are summed. Callers guarantee every judge voted every
 * model before closing, so a missing vote never silently counts as a score of 0 in a real closure.
 */
export function computeAwards(modelIds: string[], judgeIds: string[], latestVotes: LatestVote[], brackets: Bracket[]): AwardRow[] {
  const judges = new Set(judgeIds);
  const rankByKey = new Map<string, number>();
  for (const v of latestVotes) {
    if (!judges.has(v.judgeId)) continue;
    rankByKey.set(`${v.judgeId}::${v.modelId}`, v.rank);
  }
  return modelIds.map((modelId) => {
    let totalScore = 0;
    for (const judgeId of judges) totalScore += rankByKey.get(`${judgeId}::${modelId}`) ?? 0;
    return { modelId, totalScore, ...selectBracket(brackets, totalScore) };
  });
}

/**
 * Keeps the first vote seen per (judge, model). Input MUST be ordered newest first
 * (ORDER BY created_at DESC, seq DESC).
 */
export function latestVotePerJudgeModel<T extends LatestVote>(votesNewestFirst: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of votesNewestFirst) {
    const key = `${v.judgeId}::${v.modelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export type CompletionState = { totalJudges: number; completedJudges: number; allDone: boolean };

/**
 * Only completions by judges ASSIGNED to the category (directly or event-wide) count, counted
 * as distinct judges. With zero assigned judges the category can never be considered done.
 */
export function evaluateCompletion(assignedJudgeIds: string[], completedJudgeIds: string[]): CompletionState {
  const assigned = new Set(assignedJudgeIds);
  const completed = new Set(completedJudgeIds.filter((id) => assigned.has(id)));
  return {
    totalJudges: assigned.size,
    completedJudges: completed.size,
    allDone: assigned.size > 0 && completed.size >= assigned.size
  };
}

/** Models of the category the judge has NOT voted at least once. */
export function missingVoteModelIds(categoryModelIds: string[], votedModelIds: string[]): string[] {
  const voted = new Set(votedModelIds);
  return categoryModelIds.filter((id) => !voted.has(id));
}

/** Judges (among `judgeIds`) that did not vote every model. */
export function judgesWithMissingVotes(judgeIds: string[], modelIds: string[], votePairs: { judgeId: string; modelId: string }[]): string[] {
  const pairs = new Set(votePairs.map((v) => `${v.judgeId}::${v.modelId}`));
  return judgeIds.filter((j) => modelIds.some((m) => !pairs.has(`${j}::${m}`)));
}
