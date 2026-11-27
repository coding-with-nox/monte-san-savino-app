import { Elysia, t } from "elysia";
import { eq, inArray, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { awardsTable, categoriesTable, honorsTable, modelsTable, specialMentionsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { isUuid } from "./class-print.routes";
import { requireVisibleSection } from "../../../identity/infra/http/section.middleware";
import { loadHonorViews } from "../persistence/ceremony";
import { buildHonorsSummary, type HonorView } from "../../domain/honors";

/** Pre-aggregated by SQL (GROUP BY/COUNT); no per-model/per-award rows are loaded. */
export type StatsInput = {
  /** One row per distinct raw country value (null allowed) with its user count. */
  usersByCountryRaw: { country?: string | null; count: number }[];
  /** Users (identity fields only: needed to render names and the zero-model list). seqId = participant number. */
  users: { id: string; email: string; seqId?: number | null; firstName?: string | null; lastName?: string | null }[];
  modelsByUser: { userId: string; count: number }[];
  modelsByCategory: { categoryId: string; count: number }[];
  categories: { id: string; name: string }[];
  /** Counts per medal label and rank (rank 1 = commended). */
  awardsByMedal: { medalLabel: string; medalRank?: number; count: number }[];
  mentionsByTitle: { title: string; count: number }[];
  /** Special awards catalogue with assignments (see loadHonorViews). */
  honorViews?: HonorView[];
};

const byCountDesc = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

function userName(u: StatsInput["users"][number]) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email;
}

/** Users without models: count and list (userId for the user card, participantNumber = users.seqId). */
function zeroModelList(users: StatsInput["users"]) {
  return {
    count: users.length,
    list: users.map((u) => ({ userId: u.id, participantNumber: u.seqId ?? null, name: userName(u), email: u.email }))
  };
}

/** Sums pre-aggregated counts by key (merges keys that collapse after normalisation). */
function sumBy<T>(rows: T[], key: (r: T) => string, count: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + Number(count(r)));
  return m;
}

export function buildStatsOverview(input: StatsInput) {
  const userIds = new Set(input.users.map((u) => u.id));
  // Models of users outside the loaded user set (e.g. non "user" role) are ignored, as before.
  const perUser = sumBy(input.modelsByUser.filter((r) => userIds.has(r.userId)), (r) => r.userId, (r) => r.count);
  const perCat = sumBy(input.modelsByCategory, (r) => r.categoryId, (r) => r.count);
  const countries = sumBy(input.usersByCountryRaw, (r) => (r.country ?? "").trim() || "N/D", (r) => r.count);
  let usersTotal = 0;
  for (const c of countries.values()) usersTotal += c;
  return {
    usersTotal,
    usersByCountry: [...countries].map(([country, count]) => ({ country, count })).sort(byCountDesc),
    modelsPerUser: input.users
      .filter((u) => perUser.has(u.id))
      .map((u) => ({ userId: u.id, name: userName(u), count: perUser.get(u.id)! }))
      .sort(byCountDesc),
    modelsPerCategory: input.categories
      .map((c) => ({ categoryId: c.id, name: c.name, count: perCat.get(c.id) ?? 0 }))
      .sort(byCountDesc),
    medals: [...sumBy(input.awardsByMedal, (a) => a.medalLabel, (a) => a.count)].map(([name, count]) => ({ name, count })).sort(byCountDesc),
    zeroModelUsers: zeroModelList(input.users.filter((u) => !perUser.has(u.id))),
    // Fonte: tabella special_mentions (menzioni speciali per titolo).
    honorsSummary: [...sumBy(input.mentionsByTitle, (m) => m.title, (m) => m.count)].map(([title, count]) => ({ title, count })).sort(byCountDesc),
    // Special awards (honors) of the event: catalogue size, assigned count and the assigned ones.
    honors: buildHonorsSummary(input.honorViews ?? []),
    commendedTotal: input.awardsByMedal.filter((a) => a.medalRank === 1).reduce((sum, a) => sum + Number(a.count), 0)
  };
}

export const adminStatsRoutes = new Elysia({ prefix: "/admin/stats" })
  .use(tenantMiddleware)
  .use(requireRole("jury_president"))
  .get("/overview", async ({ tenantDb, query, set }) => {
    const eventId = (query as any)?.eventId;
    if (eventId !== undefined && !isUuid(eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const cats = await (eventId
      ? tenantDb.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.eventId, eventId as any))
      : tenantDb.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable));
    const catIds = (cats as any[]).map((c) => c.id);
    const userWhere = eq(usersTable.role, "user" as any);
    const users = await tenantDb
      .select({
        id: usersTable.id, email: usersTable.email, seqId: usersTable.seqId,
        firstName: userProfilesTable.firstName, lastName: userProfilesTable.lastName
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
      .where(userWhere);
    const usersByCountryRaw = await tenantDb
      .select({ country: userProfilesTable.country, count: sql<number>`count(*)::int` })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
      .where(userWhere)
      .groupBy(userProfilesTable.country);
    const modelsByUser = catIds.length
      ? await tenantDb
          .select({ userId: modelsTable.userId, count: sql<number>`count(*)::int` })
          .from(modelsTable)
          .where(inArray(modelsTable.categoryId, catIds))
          .groupBy(modelsTable.userId)
      : [];
    const modelsByCategory = catIds.length
      ? await tenantDb
          .select({ categoryId: modelsTable.categoryId, count: sql<number>`count(*)::int` })
          .from(modelsTable)
          .where(inArray(modelsTable.categoryId, catIds))
          .groupBy(modelsTable.categoryId)
      : [];
    const awardsByMedal = catIds.length
      ? await tenantDb
          .select({ medalLabel: awardsTable.medalLabel, medalRank: awardsTable.medalRank, count: sql<number>`count(*)::int` })
          .from(awardsTable)
          .where(inArray(awardsTable.categoryId, catIds))
          .groupBy(awardsTable.medalLabel, awardsTable.medalRank)
          .orderBy(awardsTable.medalLabel)
      : [];
    const mentionsBase = tenantDb
      .select({ title: specialMentionsTable.title, count: sql<number>`count(*)::int` })
      .from(specialMentionsTable);
    const mentionsByTitle = await (eventId
      ? mentionsBase.where(eq(specialMentionsTable.eventId, eventId as any)).groupBy(specialMentionsTable.title).orderBy(specialMentionsTable.title)
      : mentionsBase.groupBy(specialMentionsTable.title).orderBy(specialMentionsTable.title));
    // Honors of the event; without eventId, of every event that has special awards.
    const honorEventIds = eventId
      ? [eventId as string]
      : (await tenantDb.selectDistinct({ eventId: honorsTable.eventId }).from(honorsTable)).map((r: any) => r.eventId as string);
    const honorViews = (await Promise.all(honorEventIds.map((id) => loadHonorViews(tenantDb, id)))).flat();
    return buildStatsOverview({ usersByCountryRaw, users, modelsByUser, modelsByCategory, categories: cats, awardsByMedal, mentionsByTitle, honorViews } as StatsInput);
  }, {
    query: t.Object({ eventId: t.Optional(t.String()) }),
    beforeHandle: requireVisibleSection("stats"),
    detail: { summary: "Statistiche generali (presidente di giuria, manager)", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });
