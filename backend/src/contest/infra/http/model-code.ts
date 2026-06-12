import { eq } from "drizzle-orm";
import { settingsTable } from "../persistence/schema";

const DEFAULT_DISPLAY_PADDING = 4;
const MIN_PADDING = 1;
const MAX_PADDING = 10;

export function normalizeDisplayNumberPadding(value?: string | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DISPLAY_PADDING;
  return Math.min(MAX_PADDING, Math.max(MIN_PADDING, parsed));
}

export type ModelCodeFormat = {
  displayNumberPadding: number;
};

export function formatModelCode(
  code: number | null | undefined,
  categorySeqId: number | null | undefined,
  displayNumber: number | null | undefined,
  format: ModelCodeFormat
): string {
  if (code === null || code === undefined) return "";
  if (categorySeqId === null || categorySeqId === undefined) return "";
  if (displayNumber === null || displayNumber === undefined) return "";
  const numCode = Math.max(0, Math.trunc(Number(code)));
  const numDisplay = Math.max(0, Math.trunc(Number(displayNumber)));
  const numCat = Math.max(0, Math.trunc(Number(categorySeqId)));
  const paddedDisplay = String(numDisplay).padStart(format.displayNumberPadding, "0");
  return `M${numCat}-${paddedDisplay}-${numCode}`;
}

export async function loadModelCodeFormatSettings(tenantDb: any): Promise<ModelCodeFormat> {
  const [paddingRow] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "displayNumberPadding" as any))
    .limit(1);

  return {
    displayNumberPadding: normalizeDisplayNumberPadding(paddingRow?.value)
  };
}
