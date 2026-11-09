export const MAX_PAGE_LIMIT = 500;

export type PageParams = { limit?: number; offset: number };
export type PageParse =
  | { ok: true; page: null }          // no pagination params: return everything (legacy behaviour)
  | { ok: true; page: PageParams }    // paginated: stable order by id + X-Total-Count header
  | { ok: false; error: string };

function parseNonNegInt(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Parses optional `limit` (1..500) and `offset` (>= 0). Without either param nothing is truncated.
 * Only `offset` given => paginated without a limit. Invalid values yield an error (route answers 422).
 */
export function parsePagination(query: Record<string, unknown> | undefined | null): PageParse {
  const rawLimit = query?.limit;
  const rawOffset = query?.offset;
  if (rawLimit === undefined && rawOffset === undefined) return { ok: true, page: null };
  const page: PageParams = { offset: 0 };
  if (rawLimit !== undefined) {
    const n = parseNonNegInt(rawLimit);
    if (n === null || n < 1 || n > MAX_PAGE_LIMIT) return { ok: false, error: `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}` };
    page.limit = n;
  }
  if (rawOffset !== undefined) {
    const n = parseNonNegInt(rawOffset);
    if (n === null) return { ok: false, error: "offset must be a non-negative integer" };
    page.offset = n;
  }
  return { ok: true, page };
}

/**
 * Runs a list endpoint with optional pagination. `fetch(null)` must return the full, unchanged list;
 * `fetch(page)` must apply a stable order (id) plus limit/offset (see applyPage). `count` supplies X-Total-Count.
 */
export async function withPagination<T>(
  ctx: { query?: Record<string, unknown> | null; set: { status?: any; headers: any } },
  count: () => Promise<number>,
  fetch: (page: PageParams | null) => Promise<T[]>
): Promise<T[] | { error: string }> {
  const parsed = parsePagination(ctx.query);
  if (!parsed.ok) {
    ctx.set.status = 422;
    return { error: parsed.error };
  }
  if (!parsed.page) return fetch(null);
  ctx.set.headers["X-Total-Count"] = String(await count());
  return fetch(parsed.page);
}

/** Applies stable ordering + limit/offset to a drizzle select builder (when page is set). */
export function applyPage<Q extends { orderBy: any }>(qb: Q, idColumn: unknown, page: PageParams | null): any {
  if (!page) return qb;
  let q: any = (qb as any).orderBy(idColumn);
  if (page.limit !== undefined) q = q.limit(page.limit);
  return q.offset(page.offset);
}
