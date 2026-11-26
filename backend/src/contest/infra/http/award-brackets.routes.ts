import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { awardBracketsTable, eventsTable } from "../persistence/schema";
import { bracketInputError, MSS_AWARD_BRACKET_PRESET } from "../../domain/categoryClosure";

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
  .post("/", async ({ tenantDb, body, set }) => {
    const error = bracketInputError(body);
    if (error) {
      set.status = 422;
      return { error };
    }
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
  .put("/:bracketId", async ({ tenantDb, params, body, set }) => {
    const [current] = await tenantDb
      .select()
      .from(awardBracketsTable)
      .where(eq(awardBracketsTable.id, params.bracketId as any));
    if (!current) {
      set.status = 404;
      return { error: "Bracket not found" };
    }
    const merged = {
      medalLabel: body.medalLabel ?? current.medalLabel,
      medalRank: body.medalRank ?? current.medalRank,
      lowLimit: body.lowLimit ?? current.lowLimit,
      highLimit: body.highLimit ?? current.highLimit
    };
    const error = bracketInputError(merged);
    if (error) {
      set.status = 422;
      return { error };
    }
    const [updated] = await tenantDb
      .update(awardBracketsTable)
      .set(merged)
      .where(eq(awardBracketsTable.id, params.bracketId as any))
      .returning();
    return updated;
  }, {
    params: t.Object({ bracketId: t.String({ format: "uuid" }) }),
    body: t.Object({
      medalLabel: t.Optional(t.String()),
      medalRank: t.Optional(t.Integer()),
      lowLimit: t.Optional(t.Integer()),
      highLimit: t.Optional(t.Integer())
    }),
    detail: { summary: "Update award bracket (merged with stored values)", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/preset", async ({ tenantDb, body, set }) => {
    const [event] = await tenantDb.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, body.eventId as any));
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }
    return await tenantDb.transaction(async (tx: any) => {
      await tx.delete(awardBracketsTable).where(eq(awardBracketsTable.eventId, body.eventId as any));
      await tx.insert(awardBracketsTable).values(
        MSS_AWARD_BRACKET_PRESET.map((b) => ({ id: crypto.randomUUID(), eventId: body.eventId, ...b }))
      );
      return await tx
        .select()
        .from(awardBracketsTable)
        .where(eq(awardBracketsTable.eventId, body.eventId as any))
        .orderBy(awardBracketsTable.medalRank);
    });
  }, {
    body: t.Object({ eventId: t.String({ format: "uuid" }) }),
    detail: {
      summary: "Replace event brackets with the Monte San Savino Show preset",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:bracketId", async ({ tenantDb, params }) => {
    await tenantDb.delete(awardBracketsTable).where(eq(awardBracketsTable.id, params.bracketId as any));
    return { deleted: true };
  }, {
    params: t.Object({ bracketId: t.String() }),
    detail: { summary: "Delete award bracket", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });
