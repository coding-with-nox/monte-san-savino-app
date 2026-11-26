import { and, eq, inArray } from "drizzle-orm";
import {
  categoriesTable, eventsTable, memberRolesTable, modelsTable, modelTeamMembersTable, settingsTable, teamMatesTable
} from "./schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "../http/model-code";
import { computePricing, DEFAULT_MEMBER_PRICE_CENTS, parseBaseFeeCents, type PricingMember, type PricingModel } from "../../domain/pricing";

export const BASE_FEE_KEY = "baseFeeCents";

type MemberRow = { name: string; surname: string; role: string; roleId?: string | null; email?: string | null };
type RoleRow = { id: string; name: string; price: number };

/** Price by roleId, falling back to the role name (legacy rows) and then to the default price. */
export function toPricingMember(row: MemberRow, roles: RoleRow[]): PricingMember {
  const role = roles.find((r) => r.id === row.roleId)
    ?? roles.find((r) => r.name.toLowerCase() === row.role.trim().toLowerCase());
  return {
    name: row.name,
    surname: row.surname,
    email: row.email ?? null,
    roleId: role?.id ?? null,
    roleName: role?.name ?? row.role,
    priceCents: role?.price ?? DEFAULT_MEMBER_PRICE_CENTS
  };
}

/** One entry per (participant, event) that has at least one model. */
export async function loadPricingEntries(db: any, filters: { userId?: string; eventId?: string } = {}) {
  const conds: any[] = [];
  if (filters.userId) conds.push(eq(modelsTable.userId, filters.userId as any));
  if (filters.eventId) conds.push(eq(categoriesTable.eventId, filters.eventId as any));

  const rows: any[] = await db
    .select({
      modelId: modelsTable.id,
      modelName: modelsTable.name,
      userId: modelsTable.userId,
      isTeam: modelsTable.isTeam,
      teamId: modelsTable.teamId,
      teamCode: modelsTable.teamCode,
      code: modelsTable.code,
      displayNumber: modelsTable.displayNumber,
      categorySeqId: categoriesTable.seqId,
      eventId: categoriesTable.eventId,
      eventName: eventsTable.name,
      free: categoriesTable.freeToEnter,
      participantNumber: usersTable.seqId,
      email: usersTable.email,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName
    })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .leftJoin(eventsTable, eq(eventsTable.id, categoriesTable.eventId))
    .leftJoin(usersTable, eq(usersTable.id, modelsTable.userId))
    .leftJoin(userProfilesTable, eq(userProfilesTable.userId, modelsTable.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(modelsTable.code);
  if (!rows.length) return [];

  const teamRows = rows.filter((r) => r.isTeam);
  const modelIds = teamRows.map((r) => r.modelId);
  const teamIds = teamRows.map((r) => r.teamId).filter(Boolean);
  const members: any[] = modelIds.length
    ? await db.select().from(modelTeamMembersTable).where(inArray(modelTeamMembersTable.modelId, modelIds))
    : [];
  // Legacy flow: team models linked to a `teams` row and without inline coauthors.
  const mates: any[] = teamIds.length
    ? await db.select().from(teamMatesTable).where(inArray(teamMatesTable.teamId, teamIds))
    : [];
  const roles: RoleRow[] = await db.select().from(memberRolesTable);
  const [feeRow] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, BASE_FEE_KEY))
    .limit(1);
  const baseFeeCents = parseBaseFeeCents(feeRow?.value);
  const codeFormat = await loadModelCodeFormatSettings(db);

  const groups = new Map<string, { head: any; models: PricingModel[] }>();
  for (const r of rows) {
    const key = `${r.userId}:${r.eventId}`;
    const group = groups.get(key) ?? { head: r, models: [] };
    const inline = members.filter((m) => m.modelId === r.modelId);
    const coauthors = !r.isTeam ? [] : inline.length ? inline : mates.filter((m) => m.teamId === r.teamId);
    group.models.push({
      modelId: r.modelId,
      modelName: r.modelName,
      modelCode: formatModelCode(r.code, r.categorySeqId, r.displayNumber, codeFormat, r.teamCode) || null,
      free: Boolean(r.free),
      members: coauthors.map((m) => toPricingMember(m, roles))
    });
    groups.set(key, group);
  }

  return [...groups.values()].map(({ head, models }) => ({
    userId: head.userId as string,
    participantNumber: (head.participantNumber ?? null) as number | null,
    name: ([head.firstName, head.lastName].filter(Boolean).join(" ").trim() || head.email || "") as string,
    email: (head.email ?? "") as string,
    eventId: head.eventId as string,
    eventName: (head.eventName ?? "") as string,
    ...computePricing({ baseFeeCents, models })
  }));
}

export type PricingEntry = Awaited<ReturnType<typeof loadPricingEntries>>[number];
