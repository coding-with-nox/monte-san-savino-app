import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { modificationRequestsTable } from "../persistence/schema";

// Judge-facing routes: create and view own requests
export const judgeModificationRoutes = new Elysia({ prefix: "/judge/modification-requests" })
  .use(tenantMiddleware)
  .use(requireRole("judge"))
  .get("/", async ({ tenantDb, user }) => {
    return await tenantDb
      .select()
      .from(modificationRequestsTable)
      .where(eq(modificationRequestsTable.judgeId, user.id as any));
  }, {
    detail: {
      summary: "Le mie richieste di modifica",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, user, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(modificationRequestsTable).values({
      id,
      modelId: body.modelId,
      judgeId: user.id,
      reason: body.reason,
      status: "pending"
    });
    return { id };
  }, {
    body: t.Object({
      modelId: t.String(),
      reason: t.String()
    }),
    detail: {
      summary: "Richiedi modifica modello",
      description: "Il giudice può richiedere modifiche a un modello prima della valutazione.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  });

// Manager-facing routes: view all and manage status
export const adminModificationRoutes = new Elysia({ prefix: "/admin/modification-requests" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query }) => {
    const modelId = query?.modelId ? String(query.modelId) : null;
    if (modelId) {
      return await tenantDb
        .select()
        .from(modificationRequestsTable)
        .where(eq(modificationRequestsTable.modelId, modelId as any));
    }
    return await tenantDb.select().from(modificationRequestsTable);
  }, {
    detail: {
      summary: "Lista richieste di modifica (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .patch("/:requestId/status", async ({ tenantDb, params, body }) => {
    await tenantDb
      .update(modificationRequestsTable)
      .set({ status: body.status })
      .where(eq(modificationRequestsTable.id, params.requestId as any));
    return { updated: true };
  }, {
    params: t.Object({ requestId: t.String() }),
    body: t.Object({
      status: t.Union([t.Literal("pending"), t.Literal("resolved"), t.Literal("rejected")])
    }),
    detail: {
      summary: "Aggiorna stato richiesta modifica",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
