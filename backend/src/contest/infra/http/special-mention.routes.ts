import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { specialMentionsTable } from "../persistence/schema";

export const specialMentionRoutes = new Elysia({ prefix: "/awards/mentions" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return await tenantDb.select().from(specialMentionsTable);
  }, {
    detail: {
      summary: "Lista tutte le menzioni speciali",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/events/:eventId", async ({ tenantDb, params }) => {
    return await tenantDb
      .select()
      .from(specialMentionsTable)
      .where(eq(specialMentionsTable.eventId, params.eventId as any));
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Lista menzioni speciali per evento",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, body, user }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(specialMentionsTable).values({
      id,
      eventId: body.eventId,
      modelId: body.modelId,
      title: body.title,
      description: body.description ?? null,
      awardedBy: user.id
    });
    return { id };
  }, {
    body: t.Object({
      eventId: t.String(),
      modelId: t.String(),
      title: t.String(),
      description: t.Optional(t.String())
    }),
    detail: {
      summary: "Assegna menzione speciale",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:mentionId", async ({ tenantDb, params }) => {
    await tenantDb.delete(specialMentionsTable).where(eq(specialMentionsTable.id, params.mentionId as any));
    return { deleted: true };
  }, {
    params: t.Object({ mentionId: t.String() }),
    detail: {
      summary: "Rimuovi menzione speciale",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });
