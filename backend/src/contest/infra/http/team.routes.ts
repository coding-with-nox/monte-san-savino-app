import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { teamsTable, teamMembersTable } from "../persistence/schema";

export const teamRoutes = new Elysia({ prefix: "/teams" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .post("/", async ({ tenantDb, user, body }) => {
    const teamId = crypto.randomUUID();
    await tenantDb.insert(teamsTable).values({ id: teamId, name: body.name, ownerId: user.id as any });
    await tenantDb.insert(teamMembersTable).values({ teamId, userId: user.id as any, role: "owner" });
    return { id: teamId, name: body.name };
  }, {
    body: t.Object({ name: t.String() }),
    detail: {
      summary: "Crea team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/", async ({ tenantDb, user }) => {
    return await tenantDb
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        ownerId: teamsTable.ownerId,
        role: teamMembersTable.role
      })
      .from(teamMembersTable)
      .innerJoin(teamsTable, eq(teamMembersTable.teamId, teamsTable.id))
      .where(eq(teamMembersTable.userId, user.id as any));
  }, {
    detail: {
      summary: "Lista team utente",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/:teamId", async ({ tenantDb, user, params, set }) => {
    const membership = await tenantDb
      .select({ teamId: teamMembersTable.teamId })
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, params.teamId as any), eq(teamMembersTable.userId, user.id as any)));
    if (!membership.length) {
      set.status = 404;
      return { error: "Team not found" };
    }
    const team = await tenantDb.select().from(teamsTable).where(eq(teamsTable.id, params.teamId as any));
    const members = await tenantDb.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, params.teamId as any));
    return { team: team[0], members };
  }, {
    params: t.Object({ teamId: t.String() }),
    detail: {
      summary: "Dettaglio team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:teamId", async ({ tenantDb, user, params, body, set }) => {
    const owner = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.teamId as any), eq(teamsTable.ownerId, user.id as any)));
    if (!owner.length) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    await tenantDb.update(teamsTable).set({ name: body.name }).where(eq(teamsTable.id, params.teamId as any));
    return { updated: true };
  }, {
    params: t.Object({ teamId: t.String() }),
    body: t.Object({ name: t.String() }),
    detail: {
      summary: "Aggiorna team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:teamId", async ({ tenantDb, user, params, set }) => {
    const owner = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.teamId as any), eq(teamsTable.ownerId, user.id as any)));
    if (!owner.length) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    await tenantDb.delete(teamMembersTable).where(eq(teamMembersTable.teamId, params.teamId as any));
    await tenantDb.delete(teamsTable).where(eq(teamsTable.id, params.teamId as any));
    return { deleted: true };
  }, {
    params: t.Object({ teamId: t.String() }),
    detail: {
      summary: "Elimina team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/:teamId/members", async ({ tenantDb, user, params, body, set }) => {
    const owner = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.teamId as any), eq(teamsTable.ownerId, user.id as any)));
    if (!owner.length) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    await tenantDb.insert(teamMembersTable).values({
      teamId: params.teamId,
      userId: body.userId,
      role: body.role ?? "member"
    });
    return { added: true };
  }, {
    params: t.Object({ teamId: t.String() }),
    body: t.Object({ userId: t.String(), role: t.Optional(t.String()) }),
    detail: {
      summary: "Aggiungi membro",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:teamId/members/:userId", async ({ tenantDb, user, params, set }) => {
    const owner = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.teamId as any), eq(teamsTable.ownerId, user.id as any)));
    if (!owner.length) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    await tenantDb.delete(teamMembersTable).where(and(eq(teamMembersTable.teamId, params.teamId as any), eq(teamMembersTable.userId, params.userId as any)));
    return { removed: true };
  }, {
    params: t.Object({ teamId: t.String(), userId: t.String() }),
    detail: {
      summary: "Rimuovi membro",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  });
