export const DEFAULT_EXPORT_MAX_ROWS = 50_000;
export const QR_CHUNK_SIZE = 25;

/** EXPORT_MAX_ROWS (positive integer), default 50000; invalid values fall back to the default. */
export function exportMaxRows(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.EXPORT_MAX_ROWS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_EXPORT_MAX_ROWS;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_EXPORT_MAX_ROWS;
}

export function exportLimitMessage(max: number): string {
  return `Export too large: more than ${max} rows. Narrow the export with filters (eventId, categoryId, ...) or raise EXPORT_MAX_ROWS.`;
}

/**
 * Queries fetch at most max+1 rows (`.limit(max + 1)`), so "more than max" is detectable without
 * loading the whole table. Returns the 413 body when over the limit, otherwise null.
 */
export function exportLimitError(rowCount: number, max: number = exportMaxRows()): { error: string } | null {
  return rowCount > max ? { error: exportLimitMessage(max) } : null;
}

/** Maps items with bounded concurrency (chunks), preserving order. */
export async function mapInChunks<T, R>(items: readonly T[], chunkSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(...(await Promise.all(items.slice(i, i + chunkSize).map(fn))));
  }
  return out;
}
