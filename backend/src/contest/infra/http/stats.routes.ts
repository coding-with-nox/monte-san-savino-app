import { Elysia, t } from "elysia";
import { eq, inArray } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { awardsTable, categoriesTable, modelsTable, specialMentionsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { isUuid } from "./class-print.routes";

export type StatsInput = {
  users: { id: string; email: string; firstName?: string | null; lastName?: string | null; country?: string | null }[];
  models: { userId: string; categoryId: string }[];
  categories: { id: string; name: string }[];
  awards: { medalLabel: string }[];
  mentions: { title: string }[];
};

const byCountDesc = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

function userName(u: StatsInput["users"][number]) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email;
}

function tally(values: string[]) {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

export function buildStatsOverview(input: StatsInput) {
  const perUser = tally(input.models.map((m) => m.userId));
  const perCat = tally(input.models.map((m) => m.categoryId));
  const countries = tally(input.users.map((u) => (u.country ?? "").trim() || "N/D"));
  return {
    usersTotal: input.users.length,
    usersByCountry: [...countries].map(([country, count]) => ({ country, count })).sort(byCountDesc),
    modelsPerUser: input.users
      .filter((u) => perUser.has(u.id))
      .map((u) => ({ userId: u.id, name: userName(u), count: perUser.get(u.id)! }))
      .sort(byCountDesc),
    modelsPerCategory: input.categories
      .map((c) => ({ categoryId: c.id, name: c.name, count: perCat.get(c.id) ?? 0 }))
      .sort(byCountDesc),
    medals: [...tally(input.awards.map((a) => a.medalLabel))].map(([name, count]) => ({ name, count })).sort(byCountDesc),
    zeroModelUsers: input.users
      .filter((u) => !perUser.has(u.id))
      .map((u) => ({ userId: u.id, name: userName(u), email: u.email })),
    // Fonte: tabella special_mentions (menzioni speciali per titolo).
    honorsSummary: [...tally(input.mentions.map((m) => m.title))].map(([title, count]) => ({ title, count })).sort(byCountDesc)
  };
}

export const adminStatsRoutes = new Elysia({ prefix: "/admin/stats" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
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
    const users = await tenantDb
      .select({
        id: usersTable.id, email: usersTable.email,
        firstName: userProfilesTable.firstName, lastName: userProfilesTable.lastName, country: userProfilesTable.country
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
      .where(eq(usersTable.role, "user" as any));
    const models = catIds.length
      ? await tenantDb.select({ userId: modelsTable.userId, categoryId: modelsTable.categoryId }).from(modelsTable).where(inArray(modelsTable.categoryId, catIds))
      : [];
    const awards = catIds.length
      ? await tenantDb.select({ medalLabel: awardsTable.medalLabel }).from(awardsTable).where(inArray(awardsTable.categoryId, catIds))
      : [];
    const mentions = await (eventId
      ? tenantDb.select({ title: specialMentionsTable.title }).from(specialMentionsTable).where(eq(specialMentionsTable.eventId, eventId as any))
      : tenantDb.select({ title: specialMentionsTable.title }).from(specialMentionsTable));
    return buildStatsOverview({ users, models, categories: cats, awards, mentions } as StatsInput);
  }, {
    query: t.Object({ eventId: t.Optional(t.String()) }),
    detail: { summary: "Statistiche generali (manager)", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });
