import { eq } from "drizzle-orm";
import { settingsTable } from "../persistence/schema";

const DEFAULT_PREFIX = "MSS";
const DEFAULT_DIGITS = 5;
const MIN_DIGITS = 1;
const MAX_DIGITS = 10;

export type ModelCodeFormat = {
  prefix: string;
  digits: number;
};

export function normalizeModelCodePrefix(value?: string | null): string {
  const cleaned = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return cleaned || DEFAULT_PREFIX;
}

export function normalizeModelCodeDigits(value?: string | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DIGITS;
  return Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, parsed));
}

export function formatModelCode(code: number | null | undefined, format: ModelCodeFormat): string {
  if (code === null || code === undefined) return "";
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return "";
  const normalized = Math.max(0, Math.trunc(numeric));
  return `${format.prefix}-${String(normalized).padStart(format.digits, "0")}`;
}

export async function loadModelCodeFormatSettings(tenantDb: any): Promise<ModelCodeFormat> {
  const [prefixRow] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "printCodePrefix" as any))
    .limit(1);

  const [digitsRow] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "printCodeDigits" as any))
    .limit(1);

  return {
    prefix: normalizeModelCodePrefix(prefixRow?.value),
    digits: normalizeModelCodeDigits(digitsRow?.value)
  };
}
