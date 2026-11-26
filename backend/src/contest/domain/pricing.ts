/** Enrollment pricing rules. All amounts are integer cents (EUR). Pure: no I/O. */
export const CURRENCY = "EUR" as const;
export const DEFAULT_BASE_FEE_CENTS = 2500;
export const DEFAULT_MEMBER_PRICE_CENTS = 1500;
export const MAX_MODELS_PER_PARTICIPANT = 50;

export type PricingMember = {
  name: string;
  surname: string;
  email?: string | null;
  roleId: string | null;
  roleName: string;
  priceCents: number;
};

export type PricingModel = {
  modelId: string;
  modelName: string;
  modelCode: string | null;
  /** True when the model's level is free to enter (juniores). */
  free: boolean;
  /** Coauthors (empty for individual models). */
  members: PricingMember[];
};

type ModelRef = { modelId: string; modelName: string; modelCode: string | null };

/** One line per distinct coauthor; modelId/modelName/modelCode refer to the first paid model, `models` to all of them. */
export type CoauthorLine = PricingMember & ModelRef & { models: ModelRef[] };

/** Same person across models: email when present, otherwise name + surname (case/space-insensitive). */
export function coauthorKey(member: Pick<PricingMember, "name" | "surname" | "email">): string {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const email = norm(member.email);
  return email ? `e:${email}` : `n:${norm(member.name)}|${norm(member.surname)}`;
}

export type PricingSummary = {
  currency: typeof CURRENCY;
  /** Base fee actually applied: 0 when the participant has no paid model. */
  baseFeeCents: number;
  coauthorLines: CoauthorLine[];
  coauthorsTotalCents: number;
  freeModels: { modelId: string; modelName: string; modelCode: string | null }[];
  modelCount: number;
  paidModelCount: number;
  totalCents: number;
};

/** Parses the `baseFeeCents` setting; anything but a non-negative integer falls back to the default. */
export function parseBaseFeeCents(value: string | null | undefined): number {
  const raw = (value ?? "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : DEFAULT_BASE_FEE_CENTS;
}

/**
 * One participant, one event: a single base fee (only if at least one model is paid) plus one
 * line per distinct coauthor across all paid models (a coauthor on several models pays once,
 * at the highest of their role prices). Free models cost nothing, coauthors included.
 */
export function computePricing(input: { baseFeeCents: number; models: PricingModel[] }): PricingSummary {
  const paid = input.models.filter((m) => !m.free);
  const byPerson = new Map<string, CoauthorLine>();
  for (const m of paid) {
    const ref: ModelRef = { modelId: m.modelId, modelName: m.modelName, modelCode: m.modelCode };
    for (const member of m.members) {
      const key = coauthorKey(member);
      const line = byPerson.get(key);
      if (!line) {
        byPerson.set(key, { ...ref, ...member, models: [ref] });
        continue;
      }
      if (!line.models.some((x) => x.modelId === m.modelId)) line.models.push(ref);
      if (member.priceCents > line.priceCents) {
        line.priceCents = member.priceCents;
        line.roleId = member.roleId;
        line.roleName = member.roleName;
      }
    }
  }
  const coauthorLines = [...byPerson.values()];
  const baseFeeCents = paid.length ? input.baseFeeCents : 0;
  const coauthorsTotalCents = coauthorLines.reduce((sum, line) => sum + line.priceCents, 0);
  return {
    currency: CURRENCY,
    baseFeeCents,
    coauthorLines,
    coauthorsTotalCents,
    freeModels: input.models
      .filter((m) => m.free)
      .map(({ modelId, modelName, modelCode }) => ({ modelId, modelName, modelCode })),
    modelCount: input.models.length,
    paidModelCount: paid.length,
    totalCents: baseFeeCents + coauthorsTotalCents
  };
}

/** "€ 25,00" */
export function formatEuro(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}
