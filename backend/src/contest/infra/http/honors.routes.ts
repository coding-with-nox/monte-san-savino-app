import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, honorAssignmentsTable, honorsTable, modelsTable } from "../persistence/schema";
import { loadHonorViews } from "../persistence/ceremony";
import {
  honorInputError, nextHonorSortOrder, planHonorPreset, sameHonorCode
} from "../../domain/honors";
import { isUuid } from "./class-print.routes";

/** Unique violation on honors (event, code) or honor_assignments (honor): the request conflicts with stored data. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function trimmedHonor(input: { code?: string; name?: string }, current?: { code: string; name: string }) {
  return {
    code: (input.code ?? current?.code ?? "").trim(),
    name: (input.name ?? current?.name ?? "").trim()
  };
}

export const adminHonorRoutes = new Elysia({ prefix: "/admin/honors" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query, set }) => {
    if (!isUuid(query.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    return await loadHonorViews(tenantDb, query.eventId);
  }, {
    query: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Catalogo premi speciali dell'evento con assegnazione",
      description: "Ordinato per sortOrder. assignment: { categoryId, categoryName, displayNumber, modelId, modelName, modelCode, wholeDisplay, exhibitor } oppure null.",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, body, set }) => {
    if (!isUuid(body.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const input = trimmedHonor(body);
    const error = honorInputError(input);
    if (error) {
      set.status = 422;
      return { error };
    }
    const [event] = await tenantDb.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, body.eventId as any));
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }
    const existing = await tenantDb.select().from(honorsTable).where(eq(honorsTable.eventId, body.eventId as any));
    if (existing.some((h: any) => sameHonorCode(h.code, input.code))) {
      set.status = 409;
      return { error: "Code already used in this event", code: "DUPLICATE_CODE" };
    }
    const id = crypto.randomUUID();
    try {
      await tenantDb.insert(honorsTable).values({
        id,
        eventId: body.eventId,
        code: input.code,
        name: input.name,
        sortOrder: body.sortOrder ?? nextHonorSortOrder(existing)
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      set.status = 409;
      return { error: "Code already used in this event", code: "DUPLICATE_CODE" };
    }
    return { id };
  }, {
    body: t.Object({
      eventId: t.String(),
      code: t.String({ maxLength: 20 }),
      name: t.String({ maxLength: 120 }),
      sortOrder: t.Optional(t.Integer())
    }),
    detail: {
      summary: "Crea premio speciale",
      description: "code 1-20 caratteri, name 1-120, unico per evento (case-insensitive): 409 DUPLICATE_CODE.",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:id", async ({ tenantDb, params, body, set }) => {
    if (!isUuid(params.id)) {
      set.status = 422;
      return { error: "id must be a valid uuid" };
    }
    const [current] = await tenantDb.select().from(honorsTable).where(eq(honorsTable.id, params.id as any));
    if (!current) {
      set.status = 404;
      return { error: "Honor not found" };
    }
    const input = trimmedHonor(body, current);
    const error = honorInputError(input);
    if (error) {
      set.status = 422;
      return { error };
    }
    const siblings = await tenantDb.select().from(honorsTable).where(eq(honorsTable.eventId, current.eventId as any));
    if (siblings.some((h: any) => h.id !== current.id && sameHonorCode(h.code, input.code))) {
      set.status = 409;
      return { error: "Code already used in this event", code: "DUPLICATE_CODE" };
    }
    try {
      const [updated] = await tenantDb
        .update(honorsTable)
        .set({ code: input.code, name: input.name, sortOrder: body.sortOrder ?? current.sortOrder })
        .where(eq(honorsTable.id, current.id))
        .returning();
      return updated;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      set.status = 409;
      return { error: "Code already used in this event", code: "DUPLICATE_CODE" };
    }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      code: t.Optional(t.String({ maxLength: 20 })),
      name: t.Optional(t.String({ maxLength: 120 })),
      sortOrder: t.Optional(t.Integer())
    }),
    detail: {
      summary: "Aggiorna premio speciale (campi merge con i valori salvati)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:id", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.id)) {
      set.status = 422;
      return { error: "id must be a valid uuid" };
    }
    const [honor] = await tenantDb.select({ id: honorsTable.id }).from(honorsTable).where(eq(honorsTable.id, params.id as any));
    if (!honor) {
      set.status = 404;
      return { error: "Honor not found" };
    }
    const [assignment] = await tenantDb
      .select({ id: honorAssignmentsTable.id })
      .from(honorAssignmentsTable)
      .where(eq(honorAssignmentsTable.honorId, honor.id as any));
    if (assignment) {
      set.status = 409;
      return { error: "Honor is assigned: remove the assignment first", code: "HONOR_ASSIGNED" };
    }
    await tenantDb.delete(honorsTable).where(eq(honorsTable.id, honor.id as any));
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      summary: "Elimina premio speciale (409 se assegnato)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/preset", async ({ tenantDb, body, set }) => {
    if (!isUuid(body.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const [event] = await tenantDb.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, body.eventId as any));
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }
    return await tenantDb.transaction(async (tx: any) => {
      const existing = await tx.select().from(honorsTable).where(eq(honorsTable.eventId, body.eventId as any));
      const toInsert = planHonorPreset(existing);
      if (toInsert.length > 0) {
        await tx.insert(honorsTable).values(toInsert.map((h) => ({ id: crypto.randomUUID(), eventId: body.eventId, ...h })));
      }
      return { inserted: toInsert.length, honors: await loadHonorViews(tx, body.eventId) };
    });
  }, {
    body: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Inserisce il catalogo MSS dei premi speciali (salta i codici già presenti)",
      description: "Idempotente: { inserted, honors }. Ordine di inserimento = ordine del catalogo.",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/:id/assign", async ({ tenantDb, params, body, set, user }) => {
    if (!isUuid(params.id)) {
      set.status = 422;
      return { error: "id must be a valid uuid" };
    }
    const [honor] = await tenantDb.select().from(honorsTable).where(eq(honorsTable.id, params.id as any));
    if (!honor) {
      set.status = 404;
      return { error: "Honor not found" };
    }
    const [already] = await tenantDb
      .select({ id: honorAssignmentsTable.id })
      .from(honorAssignmentsTable)
      .where(eq(honorAssignmentsTable.honorId, honor.id as any));
    if (already) {
      set.status = 409;
      return { error: "Honor already assigned", code: "ALREADY_ASSIGNED" };
    }
    if (!isUuid(body.categoryId) || (body.modelId !== undefined && !isUuid(body.modelId))) {
      set.status = 422;
      return { error: "categoryId and modelId must be valid uuids" };
    }

    const [category] = await tenantDb
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(and(eq(categoriesTable.id, body.categoryId as any), eq(categoriesTable.eventId, honor.eventId as any)));
    if (!category) {
      set.status = 422;
      return { error: "Category does not belong to the honor's event", code: "CATEGORY_NOT_IN_EVENT" };
    }

    const displayModels = await tenantDb
      .select({ id: modelsTable.id })
      .from(modelsTable)
      .where(and(
        eq(modelsTable.categoryId, category.id as any),
        eq(modelsTable.displayNumber, body.displayNumber)
      ));
    if (displayModels.length === 0) {
      set.status = 422;
      return { error: "No display with that number in the category", code: "DISPLAY_NOT_FOUND" };
    }

    if (body.modelId !== undefined) {
      const [model] = await tenantDb
        .select({ id: modelsTable.id, categoryId: modelsTable.categoryId, displayNumber: modelsTable.displayNumber })
        .from(modelsTable)
        .where(eq(modelsTable.id, body.modelId as any));
      if (!model) {
        set.status = 404;
        return { error: "Model not found", code: "MODEL_NOT_FOUND" };
      }
      if (model.categoryId !== category.id || model.displayNumber !== body.displayNumber) {
        set.status = 422;
        return { error: "Model is not in that display", code: "MODEL_NOT_IN_DISPLAY" };
      }
    }

    try {
      await tenantDb.insert(honorAssignmentsTable).values({
        id: crypto.randomUUID(),
        honorId: honor.id,
        categoryId: category.id,
        displayNumber: body.displayNumber,
        modelId: body.modelId ?? null,
        assignedBy: user!.id
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      set.status = 409;
      return { error: "Honor already assigned", code: "ALREADY_ASSIGNED" };
    }
    const view = (await loadHonorViews(tenantDb, honor.eventId)).find((h) => h.id === honor.id);
    return view;
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      categoryId: t.String(),
      displayNumber: t.Integer(),
      modelId: t.Optional(t.String())
    }),
    detail: {
      summary: "Assegna il premio a un display (o a un modello del display), una sola volta",
      description: "categoryId dell'evento (422 CATEGORY_NOT_IN_EVENT), display con quel numero nella classe (422 DISPLAY_NOT_FOUND), modelId opzionale: 404 MODEL_NOT_FOUND, 422 MODEL_NOT_IN_DISPLAY. Già assegnato: 409 ALREADY_ASSIGNED.",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:id/assignment", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.id)) {
      set.status = 422;
      return { error: "id must be a valid uuid" };
    }
    const deleted = await tenantDb
      .delete(honorAssignmentsTable)
      .where(eq(honorAssignmentsTable.honorId, params.id as any))
      .returning({ id: honorAssignmentsTable.id });
    if (deleted.length === 0) {
      set.status = 404;
      return { error: "Assignment not found" };
    }
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
      summary: "Rimuove l'assegnazione del premio speciale",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
