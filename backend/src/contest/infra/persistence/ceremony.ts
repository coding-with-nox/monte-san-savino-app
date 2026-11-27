import { eq, inArray } from "drizzle-orm";
import {
  awardsTable, categoriesTable, honorAssignmentsTable, honorsTable, modelsTable, settingsTable
} from "./schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "../http/model-code";
import { displayName } from "../http/class-print.routes";
import { parsePrizeOrder, PRIZE_ORDER_KEY } from "../../domain/prizeOrder";
import { buildHonorViews, type HonorView } from "../../domain/honors";
import {
  buildCeremonyClasses, toCeremonyHonors, type CeremonyCategory, type CeremonyClass, type CeremonyHonor,
  type CeremonyModel, type CeremonyAwardRow
} from "../../domain/ceremony";

/** Everything the honors and the ceremony need for one event, read in a fixed number of queries. */
async function loadEventCatalog(tenantDb: any, eventId: string) {
  const categories = (await tenantDb
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      status: categoriesTable.status,
      seqId: categoriesTable.seqId,
      classNumber: categoriesTable.classNumber,
      presentationOrder: categoriesTable.presentationOrder
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.eventId, eventId as any))) as (CeremonyCategory & { seqId: number })[];

  const codeFormat = await loadModelCodeFormatSettings(tenantDb);
  const modelRows = await tenantDb
    .select({
      id: modelsTable.id,
      categoryId: modelsTable.categoryId,
      categorySeqId: categoriesTable.seqId,
      name: modelsTable.name,
      code: modelsTable.code,
      displayNumber: modelsTable.displayNumber,
      teamCode: modelsTable.teamCode,
      email: usersTable.email,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName
    })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .leftJoin(usersTable, eq(usersTable.id, modelsTable.userId))
    .leftJoin(userProfilesTable, eq(userProfilesTable.userId, modelsTable.userId))
    .where(eq(categoriesTable.eventId, eventId as any));
  const models: CeremonyModel[] = (modelRows as any[]).map((m) => ({
    id: m.id,
    categoryId: m.categoryId,
    name: m.name ?? "",
    displayNumber: m.displayNumber ?? null,
    modelCode: formatModelCode(m.code, m.categorySeqId, m.displayNumber, codeFormat, m.teamCode) || null,
    exhibitor: displayName(m.firstName, m.lastName, m.email)
  }));

  const closedIds = categories.filter((c) => c.status === "closed").map((c) => c.id);
  const awards: CeremonyAwardRow[] = closedIds.length
    ? await tenantDb
      .select({
        categoryId: awardsTable.categoryId,
        modelId: awardsTable.modelId,
        medalLabel: awardsTable.medalLabel,
        medalRank: awardsTable.medalRank
      })
      .from(awardsTable)
      .where(inArray(awardsTable.categoryId, closedIds as any))
    : [];

  const [orderRow] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, PRIZE_ORDER_KEY))
    .limit(1);
  const prizeOrder = parsePrizeOrder(orderRow?.value);

  const honors = await tenantDb.select().from(honorsTable).where(eq(honorsTable.eventId, eventId as any));
  const honorIds = honors.map((h: any) => h.id as string);
  const assignments = honorIds.length
    ? await tenantDb.select().from(honorAssignmentsTable).where(inArray(honorAssignmentsTable.honorId, honorIds as any))
    : [];

  return { categories, models, awards, prizeOrder, honors, assignments };
}

/** Catalogue of the event's honors, each with its assignment (null when not assigned yet). */
export async function loadHonorViews(tenantDb: any, eventId: string): Promise<HonorView[]> {
  const catalog = await loadEventCatalog(tenantDb, eventId);
  return buildHonorViews({
    honors: catalog.honors,
    assignments: catalog.assignments,
    categories: catalog.categories,
    models: catalog.models
  });
}

/** Ceremony data of an event: closed classes with medals, and the assigned special awards. */
export async function loadCeremony(tenantDb: any, eventId: string): Promise<{ classes: CeremonyClass[]; honors: CeremonyHonor[] }> {
  const catalog = await loadEventCatalog(tenantDb, eventId);
  const classes = buildCeremonyClasses({
    categories: catalog.categories,
    models: catalog.models,
    awards: catalog.awards,
    prizeOrder: catalog.prizeOrder
  });
  const honorViews = buildHonorViews({
    honors: catalog.honors,
    assignments: catalog.assignments,
    categories: catalog.categories,
    models: catalog.models
  });
  return { classes, honors: toCeremonyHonors(honorViews) };
}
