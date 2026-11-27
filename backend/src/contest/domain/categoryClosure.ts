/**
 * Pure rules for category completion / closure and award computation.
 * No I/O here: everything is unit-testable without a database.
 */

export type Bracket = { medalLabel: string; medalRank: number; lowLimit: number; highLimit: number };
export type LatestVote = { judgeId: string; modelId: string; rank: number };
export type AwardRow = { modelId: string; totalScore: number; medalLabel: string; medalRank: number; issues: string[] };
/** Judges expected to vote a model (see expectedVoters.ts). */
export type ModelExpectation = { modelId: string; expectedJudgeIds: string[] };

/** N = votes per exhibitor (votesPerExhibit), D = max allowed spread between judges (maxDelta). */
export type JudgingRules = { votesPerExhibit: number; maxDelta: number };

export const JUDGING_SETTING_KEYS = ["maxVotesPerExhibitor", "maxVoteDifferent"] as const;
export type JudgingSettingKey = (typeof JUDGING_SETTING_KEYS)[number];

const JUDGING_LIMITS: Record<JudgingSettingKey, { min: number; max: number; fallback: number }> = {
  maxVotesPerExhibitor: { min: 1, max: 10, fallback: 3 },
  maxVoteDifferent: { min: 0, max: 40, fallback: 2 }
};

const isIntegerIn = (raw: string, min: number, max: number) => /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= max;

/** Settings -> rules. Missing or invalid values fall back to the defaults. */
export function parseJudgingRules(settings: Partial<Record<JudgingSettingKey, string>>): JudgingRules {
  const pick = (key: JudgingSettingKey) => {
    const { min, max, fallback } = JUDGING_LIMITS[key];
    const raw = settings[key];
    return raw !== undefined && isIntegerIn(raw, min, max) ? Number(raw) : fallback;
  };
  return { votesPerExhibit: pick("maxVotesPerExhibitor"), maxDelta: pick("maxVoteDifferent") };
}

/** Validation for PUT /admin/settings: error message for the first invalid judging key, else null. */
export function judgingSettingsError(entries: [string, string][]): string | null {
  for (const [key, value] of entries) {
    if (!(JUDGING_SETTING_KEYS as readonly string[]).includes(key)) continue;
    const { min, max } = JUDGING_LIMITS[key as JudgingSettingKey];
    if (!isIntegerIn(String(value), min, max)) return `${key} must be an integer between ${min} and ${max}`;
  }
  return null;
}

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

/** Medal brackets of the Monte San Savino Show (legacy "Emperor" rules, N=3). */
export const MSS_AWARD_BRACKET_PRESET: Bracket[] = [
  { medalLabel: "None", medalRank: 0, lowLimit: 0, highLimit: 0 },
  { medalLabel: "Highly Commended", medalRank: 1, lowLimit: 1, highLimit: 4 },
  { medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 7 },
  { medalLabel: "Silver", medalRank: 3, lowLimit: 8, highLimit: 10 },
  { medalLabel: "Gold", medalRank: 4, lowLimit: 11, highLimit: 12 }
];

/** Validation of a bracket (create/update, after merging with the stored row). Error message or null. */
export function bracketInputError(b: Bracket): string | null {
  if (b.medalLabel.trim().length === 0 || b.medalLabel.length > 40) return "medalLabel must be 1-40 characters";
  if (!Number.isInteger(b.medalRank) || b.medalRank < 0 || b.medalRank > 10) return "medalRank must be an integer between 0 and 10";
  if (!Number.isInteger(b.lowLimit) || b.lowLimit < 0) return "lowLimit must be a non-negative integer";
  if (!Number.isInteger(b.highLimit) || b.highLimit < 0) return "highLimit must be a non-negative integer";
  if (b.lowLimit > b.highLimit) return "lowLimit must be <= highLimit";
  return null;
}

/**
 * Computes the award of each model. `latestVotes` must contain AT MOST the latest vote per
 * (judge, model). Only votes of the EXPECTED voters of each model are used.
 *
 * Score (Emperor rule): with `voters` judges who voted the model, totalScore = round(mean(ranks) * N).
 * With exactly N judges this is the plain sum; with fewer voters it is scaled up. No vote => 0.
 *
 * Issues:
 *  - PARTIAL_VOTES: 0 < voters < expected voters of the model.
 *  - DISCORDANT_VOTES: voters > 1 and (max(ranks) * voters - sum(ranks)) > D.
 */
export function computeAwards(
  models: ModelExpectation[],
  latestVotes: LatestVote[],
  brackets: Bracket[],
  rules: JudgingRules
): AwardRow[] {
  const rankByKey = new Map<string, number>();
  for (const v of latestVotes) rankByKey.set(`${v.judgeId}::${v.modelId}`, v.rank);
  return models.map(({ modelId, expectedJudgeIds }) => {
    const ranks: number[] = [];
    for (const judgeId of new Set(expectedJudgeIds)) {
      const rank = rankByKey.get(`${judgeId}::${modelId}`);
      if (rank !== undefined) ranks.push(rank);
    }
    const voters = ranks.length;
    const sum = ranks.reduce((acc, r) => acc + r, 0);
    // Integer arithmetic before the division keeps .5 cases exact.
    const totalScore = voters > 0 ? Math.round((sum * rules.votesPerExhibit) / voters) : 0;
    const issues: string[] = [];
    if (voters > 0 && voters < new Set(expectedJudgeIds).size) issues.push("PARTIAL_VOTES");
    if (voters > 1 && Math.max(...ranks) * voters - sum > rules.maxDelta) issues.push("DISCORDANT_VOTES");
    return { modelId, totalScore, ...selectBracket(brackets, totalScore), issues };
  });
}

/**
 * Head-judge override: the medal must be "None" (rank 0) or a bracket of the event with the same label AND rank.
 */
export function isOverrideMedalAllowed(brackets: Bracket[], medal: { medalLabel: string; medalRank: number }): boolean {
  if (medal.medalLabel === "None" && medal.medalRank === 0) return true;
  return brackets.some((b) => b.medalLabel === medal.medalLabel && b.medalRank === medal.medalRank);
}

/** Missing models (manager flag) take part in no judging: no expected votes, no completion, no award row. */
export function excludeMissingModels<T extends { missing: boolean }>(models: T[]): T[] {
  return models.filter((m) => !m.missing);
}

/** Persisted form of the issues: JSON array, or null when there are none. */
export function serializeAwardIssues(issues: string[]): string | null {
  return issues.length > 0 ? JSON.stringify(issues) : null;
}

/** Reads the persisted issues; null or malformed values yield []. */
export function parseAwardIssues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
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
 * `countedJudgeIds` are the judges that count for the category (expected voters of at least one model).
 * Completions by anybody else are ignored; counted as distinct judges. Zero counted judges => never done.
 */
export function evaluateCompletion(countedJudgeIds: string[], completedJudgeIds: string[]): CompletionState {
  const counted = new Set(countedJudgeIds);
  const completed = new Set(completedJudgeIds.filter((id) => counted.has(id)));
  return {
    totalJudges: counted.size,
    completedJudges: completed.size,
    allDone: counted.size > 0 && completed.size >= counted.size
  };
}

/** Models where the judge is an expected voter and has NO vote yet. */
export function judgeMissingVoteModelIds(models: ModelExpectation[], judgeId: string, votedModelIds: string[]): string[] {
  const voted = new Set(votedModelIds);
  return models
    .filter((m) => m.expectedJudgeIds.includes(judgeId) && !voted.has(m.modelId))
    .map((m) => m.modelId);
}

/** Judges counted for the category: expected voters of at least one model. */
export function countedJudgeIds(models: ModelExpectation[]): string[] {
  return [...new Set(models.flatMap((m) => m.expectedJudgeIds))];
}

export type CategoryAssessment = {
  awards: AwardRow[];
  completion: CompletionState;
  discordantModelIds: string[];
};

/** Awards, completion and discordance of a category, from its current votes. */
export function assessCategory(input: {
  models: ModelExpectation[];
  votes: LatestVote[];
  completedJudgeIds: string[];
  brackets: Bracket[];
  rules: JudgingRules;
}): CategoryAssessment {
  const awards = computeAwards(input.models, input.votes, input.brackets, input.rules);
  return {
    awards,
    completion: evaluateCompletion(countedJudgeIds(input.models), input.completedJudgeIds),
    discordantModelIds: awards.filter((a) => a.issues.includes("DISCORDANT_VOTES")).map((a) => a.modelId)
  };
}

/**
 * Emperor "phase 2": once every counted judge completed, a category with discordant votes stays open
 * (reconciliation) until the discordance is fixed. Closed categories are always "closed".
 */
export type CategoryPhase = "judging" | "reconciliation" | "closed";
export function categoryPhase(status: string, assessment: CategoryAssessment): CategoryPhase {
  if (status === "closed") return "closed";
  return assessment.completion.allDone && assessment.discordantModelIds.length > 0 ? "reconciliation" : "judging";
}

/** The category can be closed now: open, every counted judge completed and no discordance left. */
export function readyToClose(status: string, assessment: CategoryAssessment): boolean {
  return status === "open" && assessment.completion.allDone && assessment.discordantModelIds.length === 0;
}
