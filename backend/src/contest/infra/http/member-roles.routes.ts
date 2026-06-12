import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { memberRolesTable } from "../persistence/schema";

export const adminMemberRolesRoutes = new Elysia({ prefix: "/admin/member-roles" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb.select().from(memberRolesTable).orderBy(memberRolesTable.name);
  }, {
    detail: { summary: "Lista ruoli membri", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(memberRolesTable).values({ id, name: body.name });
    return { id };
  }, {
    body: t.Object({ name: t.String() }),
    detail: { summary: "Crea ruolo membro", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .put("/:id", async ({ tenantDb, params, body, set }) => {
    const rows = await tenantDb.select().from(memberRolesTable).where(eq(memberRolesTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.update(memberRolesTable).set({ name: body.name }).where(eq(memberRolesTable.id, params.id as any));
    return { updated: true };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ name: t.Optional(t.String()) }),
    detail: { summary: "Aggiorna ruolo membro", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:id", async ({ tenantDb, params, set }) => {
    const rows = await tenantDb.select().from(memberRolesTable).where(eq(memberRolesTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.delete(memberRolesTable).where(eq(memberRolesTable.id, params.id as any));
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: "Elimina ruolo membro", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });

export const publicMemberRolesRoutes = new Elysia({ prefix: "/public/member-roles" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb.select().from(memberRolesTable).orderBy(memberRolesTable.name);
  }, {
    detail: { summary: "Lista ruoli membri (pubblico)", tags: ["Public"], security: [{ bearerAuth: [] }] }
  });
