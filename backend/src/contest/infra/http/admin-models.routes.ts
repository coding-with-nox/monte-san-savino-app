import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { modelsTable } from "../persistence/schema";

export const adminModelsRoutes = new Elysia({ prefix: "/admin/models" })
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return await tenantDb.select().from(modelsTable);
  }, {
    detail: {
      summary: "Lista modelli (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:modelId", async ({ tenantDb, params, body }) => {
    await tenantDb.update(modelsTable).set(body).where(eq(modelsTable.id, params.modelId as any));
    return { updated: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      teamId: t.Optional(t.String()),
      imageUrl: t.Optional(t.String())
    }),
    detail: {
      summary: "Aggiorna modello (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:modelId", async ({ tenantDb, params }) => {
    await tenantDb.delete(modelsTable).where(eq(modelsTable.id, params.modelId as any));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: {
      summary: "Elimina modello (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
