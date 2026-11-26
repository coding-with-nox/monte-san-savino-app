/** Enrollment pricing rules. All amounts are integer cents (EUR). Pure: no I/O. */
export const CURRENCY = "EUR" as const;
export const DEFAULT_BASE_FEE_CENTS = 2500;
export const DEFAULT_MEMBER_PRICE_CENTS = 1500;
export const MAX_MODELS_PER_PARTICIPANT = 50;

export type PricingMember = { name: string; surname: string; roleId: string | null; roleName: string; priceCents: number };

export type PricingModel = {
  modelId: string;
  modelName: string;
  modelCode: string | null;
  /** True when the model's level is free to enter (juniores). */
  free: boolean;
  /** Coauthors (empty for individual models). */
  members: PricingMember[];
};

export type CoauthorLine = PricingMember & { modelId: string; modelName: string; modelCode: string | null };

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
 * line per coauthor of each paid model. Free models cost nothing, coauthors included.
 */
export function computePricing(input: { baseFeeCents: number; models: PricingModel[] }): PricingSummary {
  const paid = input.models.filter((m) => !m.free);
  const coauthorLines = paid.flatMap((m) =>
    m.members.map((member) => ({ modelId: m.modelId, modelName: m.modelName, modelCode: m.modelCode, ...member }))
  );
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
