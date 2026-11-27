import { Language } from "./i18n";

/** Role of a team member (GET /public/member-roles). Prices are integer euro cents. */
export type MemberRole = { id: string; name: string; price?: number | null };

export type CoauthorLine = {
  modelId: string;
  modelName?: string | null;
  modelCode?: string | null;
  name: string;
  surname: string;
  roleId?: string | null;
  roleName?: string | null;
  priceCents: number;
  /** All paid models of this coauthor (charged once across models). */
  models?: { modelId: string; modelName?: string | null; modelCode?: string | null }[];
};

/** "173T1, 173T2" — every model of a coauthor line, falling back to the first one. */
export function coauthorModelsLabel(line: CoauthorLine): string {
  const models = line.models?.length ? line.models : [line];
  return models.map((m) => m.modelCode || m.modelName || "-").join(", ");
}

/** Per-event fee breakdown computed by the backend (GET /pricing/me). */
export type EventPricing = {
  eventId: string;
  eventName: string;
  baseFeeCents: number;
  coauthorsTotalCents: number;
  totalCents: number;
  modelCount: number;
  paidModelCount: number;
  coauthorLines: CoauthorLine[];
  freeModels: { modelId: string; modelName?: string | null; modelCode?: string | null }[];
};

export type PricingResponse = { currency: string; totalCents: number; events: EventPricing[] };

export function formatCents(cents: number, language: Language): string {
  return new Intl.NumberFormat(({ it: "it-IT", en: "en-IE", es: "es-ES", fr: "fr-FR", de: "de-DE" } as Record<string, string>)[language] ?? "en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** "15" / "15,50" -> cents; null when the text is not a non-negative amount. */
export function parseEuros(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
