/**
 * Live judging view of an event (Emperor "Contest Live Statistics"). Pure, no I/O.
 *
 * Open class: medals are PROJECTED from the current votes with the same scoring used at closing.
 * Closed class: medals are the FROZEN awards (overrides included).
 * Missing models and models of absent owners are not passed in (same treatment as closing).
 */
import {
  assessCategory, categoryPhase, type Bracket, type CategoryPhase, type JudgingRules, type LatestVote, type ModelExpectation
} from "./categoryClosure";
import { compareCeremonyClasses } from "./ceremony";

export type LiveCategory = {
  id: string;
  name: string;
  status: string;
  classNumber: string | null;
  presentationOrder: number | null;
};

export type LiveModel = ModelExpectation & { categoryId: string };

export type LiveClass = {
  categoryId: string;
  name: string;
  classNumber: string | null;
  presentationOrder: number | null;
  phase: CategoryPhase;
  models: number;
  votesCast: number;
  votesExpected: number;
  percent: number;
  judgesTotal: number;
  judgesCompleted: number;
  discordant: number;
  medals: Record<string, number>;
};

export type LiveTotals = {
  classes: number;
  closed: number;
  models: number;
  votesCast: number;
  votesExpected: number;
  percent: number;
  medals: Record<string, number>;
};

export type LiveJudging = { updatedAt: string; totals: LiveTotals; classes: LiveClass[] };

export type LiveJudgingInput = {
  updatedAt: string;
  categories: LiveCategory[];
  /** Models judged in the event (not missing, owner present), each with its expected voters. */
  models: LiveModel[];
  /** Latest vote per (judge, model). Votes of models outside the input are ignored. */
  votes: LatestVote[];
  completions: { categoryId: string; judgeId: string }[];
  /** Frozen awards of the closed categories (one row per model). */
  frozenAwards: { categoryId: string; medalLabel: string }[];
  brackets: Bracket[];
  rules: JudgingRules;
};

const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0);

function countMedals(labels: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const label of labels) out[label] = (out[label] ?? 0) + 1;
  return out;
}

function addMedals(target: Record<string, number>, source: Record<string, number>) {
  for (const [label, count] of Object.entries(source)) target[label] = (target[label] ?? 0) + count;
}

/** One class: progress from the expected votes, phase and discordance from the current votes, medals projected or frozen. */
export function buildLiveClass(input: {
  category: LiveCategory;
  models: ModelExpectation[];
  votes: LatestVote[];
  completedJudgeIds: string[];
  brackets: Bracket[];
  rules: JudgingRules;
  frozenMedalLabels: string[];
}): LiveClass {
  const { category } = input;
  const assessment = assessCategory({
    models: input.models,
    votes: input.votes,
    completedJudgeIds: input.completedJudgeIds,
    brackets: input.brackets,
    rules: input.rules
  });

  // Only expected voters count, as in computeAwards: a vote of a non-expected judge is not progress.
  const votedKeys = new Set(input.votes.map((v) => `${v.judgeId}::${v.modelId}`));
  let votesCast = 0;
  let votesExpected = 0;
  for (const model of input.models) {
    const expected = new Set(model.expectedJudgeIds);
    votesExpected += expected.size;
    for (const judgeId of expected) if (votedKeys.has(`${judgeId}::${model.modelId}`)) votesCast += 1;
  }

  const medals = category.status === "closed"
    ? countMedals(input.frozenMedalLabels)
    : countMedals(assessment.awards.map((a) => a.medalLabel));

  return {
    categoryId: category.id,
    name: category.name,
    classNumber: category.classNumber,
    presentationOrder: category.presentationOrder,
    phase: categoryPhase(category.status, assessment),
    models: input.models.length,
    votesCast,
    votesExpected,
    percent: percentOf(votesCast, votesExpected),
    judgesTotal: assessment.completion.totalJudges,
    judgesCompleted: assessment.completion.completedJudges,
    discordant: assessment.discordantModelIds.length,
    medals
  };
}

/** Whole-event view: classes ordered by presentationOrder, classNumber, name; totals summed over the classes. */
export function buildLiveJudging(input: LiveJudgingInput): LiveJudging {
  const classes = input.categories
    .map((category) => {
      const models = input.models.filter((m) => m.categoryId === category.id);
      return buildLiveClass({
        category,
        models,
        votes: input.votes,
        completedJudgeIds: input.completions.filter((c) => c.categoryId === category.id).map((c) => c.judgeId),
        brackets: input.brackets,
        rules: input.rules,
        frozenMedalLabels: input.frozenAwards.filter((a) => a.categoryId === category.id).map((a) => a.medalLabel)
      });
    })
    .sort(compareCeremonyClasses);

  const totals: LiveTotals = { classes: classes.length, closed: 0, models: 0, votesCast: 0, votesExpected: 0, percent: 0, medals: {} };
  for (const c of classes) {
    if (c.phase === "closed") totals.closed += 1;
    totals.models += c.models;
    totals.votesCast += c.votesCast;
    totals.votesExpected += c.votesExpected;
    addMedals(totals.medals, c.medals);
  }
  totals.percent = percentOf(totals.votesCast, totals.votesExpected);

  return { updatedAt: input.updatedAt, totals, classes };
}
