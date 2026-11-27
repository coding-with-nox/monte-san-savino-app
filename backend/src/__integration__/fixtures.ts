// testApp must be imported first: it sets the env (PG_DB=tenant_db_test, JWT_SECRET).
import { buildTestApp, type Handler } from "./testApp";
import { getTestDb } from "./testDb";
import { eq } from "drizzle-orm";
import { JwtTokenService } from "../identity/infra/tokens/jwtTokenService";
import { usersTable, userProfilesTable } from "../identity/infra/persistence/schema";
import {
  categoriesTable, eventCampaignsTable, eventsTable, judgeAssignmentsTable, judgeCompletionsTable, levelsTable,
  memberRolesTable, modelImagesTable, modelsTable, modelTeamMembersTable, previousResultsTable, registrationsTable,
  settingsTable, votesTable
} from "../contest/infra/persistence/schema";
import type { Role } from "../identity/domain/Role";

export const app: Handler = buildTestApp();

const TABLES = [
  votesTable, judgeCompletionsTable, judgeAssignmentsTable, modelTeamMembersTable, modelImagesTable,
  registrationsTable, modelsTable, categoriesTable, eventCampaignsTable, eventsTable, levelsTable,
  memberRolesTable, previousResultsTable, settingsTable, userProfilesTable, usersTable
] as const;

/** Wipes the test database (always tenant_db_test, see testDb.ts). */
export async function resetDb() {
  const db = getTestDb();
  for (const table of TABLES) await db.delete(table);
}

export async function createUser(role: Role = "user") {
  const id = crypto.randomUUID();
  const email = `${role}-${id}@example.com`;
  const db = getTestDb();
  await db.insert(usersTable).values({ id, email, role, passwordHash: "unused", isActive: true });
  const [row] = await db.select({ seqId: usersTable.seqId }).from(usersTable).where(eq(usersTable.id, id));
  const { token } = await new JwtTokenService().signAccess({ sub: id, email, role });
  return { id, email, token, seqId: row.seqId! };
}

export async function createEvent(name = "Contest test") {
  const id = crypto.randomUUID();
  await getTestDb().insert(eventsTable).values({ id, name, status: "active" });
  return id;
}

export async function createCategory(eventId: string, name = "Categoria", status: "open" | "closed" = "open", freeToEnter = false) {
  const id = crypto.randomUUID();
  await getTestDb().insert(categoriesTable).values({ id, eventId, name, status, freeToEnter });
  return id;
}

export async function createLevel(name = "Standard", freeToEnter = false) {
  const id = crypto.randomUUID();
  await getTestDb().insert(levelsTable).values({ id, name, freeToEnter });
  return id;
}

export async function createMemberRole(name = "Pittore", price = 1500) {
  const id = crypto.randomUUID();
  await getTestDb().insert(memberRolesTable).values({ id, name, price });
  return id;
}

export async function request(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await app.handle(new Request(`http://localhost${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }));
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non JSON response */ }
  return { status: res.status, json, text };
}

export const member = (roleId: string, name = "Mario", surname = "Rossi") => ({ name, surname, roleId });
