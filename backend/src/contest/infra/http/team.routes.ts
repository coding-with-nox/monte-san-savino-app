import { Elysia, t } from "elysia";
import { and, eq, sql, count } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { teamsTable, teamMatesTable, modelsTable } from "../persistence/schema";

async function generateTeamDisplayNumber(tenantDb: any): Promise<string> {
  const [{ count: cnt }] = await tenantDb
    .select({ count: sql`count(*)::int` })
    .from(teamsTable);
  const n = Number(cnt) + 1;
  const seq3 = String(Math.ceil(n / 9999)).padStart(3, "0");
  const seq4 = String(((n - 1) % 9999) + 1).padStart(4, "0");
  return `MX-${seq3}-${seq4}`;
}

export const teamRoutes = new Elysia({ prefix: "/teams" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb, user }) => {
    const rows = await tenantDb
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        displayNumber: teamsTable.displayNumber,
        categoryId: teamsTable.categoryId,
        createdAt: teamsTable.createdAt,
        mateCount: sql<number>`(select count(*) from team_mates where team_id = ${teamsTable.id})::int`
      })
      .from(teamsTable)
      .where(eq(teamsTable.userId, user!.id as any));
    return rows;
  }, {
    detail: {
      summary: "Lista team dell'utente",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, user, body, set }) => {
    const teamId = crypto.randomUUID();
    const displayNumber = await generateTeamDisplayNumber(tenantDb);

    await tenantDb.insert(teamsTable).values({
      id: teamId,
      userId: user!.id as any,
      name: body.name,
      categoryId: body.categoryId,
      displayNumber
    });

    if (body.mates?.length) {
      await tenantDb.insert(teamMatesTable).values(
        body.mates.map((m: any) => ({
          id: crypto.randomUUID(),
          teamId,
          name: m.name,
          surname: m.surname,
          role: m.role,
          email: m.email ?? null
        }))
      );
    }

    return { id: teamId, displayNumber };
  }, {
    body: t.Object({
      name: t.String(),
      categoryId: t.String(),
      mates: t.Optional(t.Array(t.Object({
        name: t.String(),
        surname: t.String(),
        role: t.String(),
        email: t.Optional(t.String({ format: "email" }))
      })))
    }),
    detail: {
      summary: "Crea team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/:id", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.id as any), eq(teamsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const mates = await tenantDb
      .select()
      .from(teamMatesTable)
      .where(eq(teamMatesTable.teamId, params.id as any));

    return { team: rows[0], mates };
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      summary: "Dettaglio team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:id", async ({ tenantDb, user, params, body, set }) => {
    const rows = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.id as any), eq(teamsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;

    if (Object.keys(updateData).length > 0) {
      await tenantDb.update(teamsTable).set(updateData).where(eq(teamsTable.id, params.id as any));
    }

    return { updated: true };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      categoryId: t.Optional(t.String())
    }),
    detail: {
      summary: "Aggiorna team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:id", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.id as any), eq(teamsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    // 1. Unlink models
    await tenantDb
      .update(modelsTable)
      .set({ teamId: null })
      .where(eq(modelsTable.teamId, params.id as any));

    // 2. Delete mates
    await tenantDb.delete(teamMatesTable).where(eq(teamMatesTable.teamId, params.id as any));

    // 3. Delete team
    await tenantDb.delete(teamsTable).where(eq(teamsTable.id, params.id as any));

    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      summary: "Elimina team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/:id/mates", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.id as any), eq(teamsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const mates = await tenantDb
      .select({
        id: teamMatesTable.id,
        name: teamMatesTable.name,
        surname: teamMatesTable.surname,
        role: teamMatesTable.role,
        email: teamMatesTable.email
      })
      .from(teamMatesTable)
      .where(eq(teamMatesTable.teamId, params.id as any));

    return mates;
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      summary: "Lista membri del team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/:id/mates", async ({ tenantDb, user, params, body, set }) => {
    const rows = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.id as any), eq(teamsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const mateId = crypto.randomUUID();
    await tenantDb.insert(teamMatesTable).values({
      id: mateId,
      teamId: params.id,
      name: body.name,
      surname: body.surname,
      role: body.role,
      email: body.email ?? null
    });

    return { id: mateId };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      surname: t.String(),
      role: t.String(),
      email: t.Optional(t.String({ format: "email" }))
    }),
    detail: {
      summary: "Aggiungi membro al team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:id/mates/:mateId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, params.id as any), eq(teamsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    await tenantDb.delete(teamMatesTable).where(
      and(
        eq(teamMatesTable.id, params.mateId as any),
        eq(teamMatesTable.teamId, params.id as any)
      )
    );

    return { deleted: true };
  }, {
    params: t.Object({ id: t.String(), mateId: t.String() }),
    detail: {
      summary: "Rimuovi membro dal team",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  });
