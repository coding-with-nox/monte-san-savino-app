import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { memberRolesTable } from "../persistence/schema";

/** Coauthor price in cents. */
const priceSchema = () => t.Integer({ minimum: 0, maximum: 1_000_000 });

/** Role names are unique case/space-insensitively (ux_member_roles_name). */
async function nameTaken(db: any, name: string, exceptId?: string): Promise<boolean> {
  const key = name.trim().toLowerCase();
  const rows: { id: string; name: string }[] = await db.select().from(memberRolesTable);
  return rows.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === key);
}

export const adminMemberRolesRoutes = new Elysia({ prefix: "/admin/member-roles" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb.select().from(memberRolesTable).orderBy(memberRolesTable.name);
  }, {
    detail: { summary: "Lista ruoli membri", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, body, set }) => {
    if (await nameTaken(tenantDb, body.name)) { set.status = 409; return { error: "Role name already exists" }; }
    const id = crypto.randomUUID();
    await tenantDb.insert(memberRolesTable).values({ id, name: body.name.trim(), price: body.price });
    return { id };
  }, {
    body: t.Object({ name: t.String(), price: t.Optional(priceSchema()) }),
    detail: { summary: "Crea ruolo membro", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .put("/:id", async ({ tenantDb, params, body, set }) => {
    const rows = await tenantDb.select().from(memberRolesTable).where(eq(memberRolesTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    if (body.name !== undefined && await nameTaken(tenantDb, body.name, params.id)) {
      set.status = 409; return { error: "Role name already exists" };
    }
    if (body.name !== undefined || body.price !== undefined) {
      await tenantDb.update(memberRolesTable).set({ name: body.name?.trim(), price: body.price }).where(eq(memberRolesTable.id, params.id as any));
    }
    return { updated: true };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ name: t.Optional(t.String()), price: t.Optional(priceSchema()) }),
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
