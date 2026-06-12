import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { levelsTable } from "../persistence/schema";

export const adminLevelsRoutes = new Elysia({ prefix: "/admin/levels" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb
      .select()
      .from(levelsTable)
      .orderBy(levelsTable.sortOrder, levelsTable.name);
  }, {
    detail: { summary: "Lista livelli", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(levelsTable).values({ id, name: body.name, sortOrder: body.sortOrder ?? null });
    return { id };
  }, {
    body: t.Object({ name: t.String(), sortOrder: t.Optional(t.Number()) }),
    detail: { summary: "Crea livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .put("/:id", async ({ tenantDb, params, body, set }) => {
    const rows = await tenantDb.select().from(levelsTable).where(eq(levelsTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.update(levelsTable).set(body).where(eq(levelsTable.id, params.id as any));
    return { updated: true };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ name: t.Optional(t.String()), sortOrder: t.Optional(t.Number()) }),
    detail: { summary: "Aggiorna livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:id", async ({ tenantDb, params, set }) => {
    const rows = await tenantDb.select().from(levelsTable).where(eq(levelsTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.delete(levelsTable).where(eq(levelsTable.id, params.id as any));
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: "Elimina livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });

export const publicLevelsRoutes = new Elysia({ prefix: "/public/levels" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb
      .select()
      .from(levelsTable)
      .orderBy(levelsTable.sortOrder, levelsTable.name);
  }, {
    detail: { summary: "Lista livelli (pubblico)", tags: ["Public"], security: [{ bearerAuth: [] }] }
  });
