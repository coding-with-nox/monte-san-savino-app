import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { awardBracketsTable } from "../persistence/schema";

export const awardBracketsRoutes = new Elysia({ prefix: "/admin/award-brackets" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (!eventId) return [];
    return await tenantDb
      .select()
      .from(awardBracketsTable)
      .where(eq(awardBracketsTable.eventId, eventId as any))
      .orderBy(awardBracketsTable.medalRank);
  }, {
    detail: { summary: "List award brackets for event", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(awardBracketsTable).values({
      id,
      eventId: body.eventId,
      medalLabel: body.medalLabel,
      medalRank: body.medalRank,
      lowLimit: body.lowLimit,
      highLimit: body.highLimit
    });
    return { id };
  }, {
    body: t.Object({
      eventId: t.String(),
      medalLabel: t.String(),
      medalRank: t.Integer(),
      lowLimit: t.Integer(),
      highLimit: t.Integer()
    }),
    detail: { summary: "Create award bracket", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:bracketId", async ({ tenantDb, params }) => {
    await tenantDb.delete(awardBracketsTable).where(eq(awardBracketsTable.id, params.bracketId as any));
    return { deleted: true };
  }, {
    params: t.Object({ bracketId: t.String() }),
    detail: { summary: "Delete award bracket", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });
