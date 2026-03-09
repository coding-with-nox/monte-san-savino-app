import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { teamRolesTable } from "../persistence/schema";

// Manager CRUD for predefined team roles (Task 08)
export const teamRolesRoutes = new Elysia({ prefix: "/admin/team-roles" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return await tenantDb.select().from(teamRolesTable);
  }, {
    detail: {
      summary: "Lista ruoli team",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(teamRolesTable).values({ id, name: body.name });
    return { id };
  }, {
    body: t.Object({ name: t.String() }),
    detail: {
      summary: "Crea ruolo team",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:roleId", async ({ tenantDb, params }) => {
    await tenantDb.delete(teamRolesTable).where(eq(teamRolesTable.id, params.roleId as any));
    return { deleted: true };
  }, {
    params: t.Object({ roleId: t.String() }),
    detail: {
      summary: "Elimina ruolo team",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });

// User-accessible read for role selector in Teams tab (Task 09)
export const teamRolesPublicRoutes = new Elysia({ prefix: "/team-roles" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    return await tenantDb.select().from(teamRolesTable);
  }, {
    detail: {
      summary: "Lista ruoli team (lettura)",
      tags: ["Teams"],
      security: [{ bearerAuth: [] }]
    }
  });
