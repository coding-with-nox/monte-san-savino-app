import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { loadCeremony } from "../persistence/ceremony";
import { isUuid } from "./class-print.routes";

export const ceremonyRoutes = new Elysia({ prefix: "/awards" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/events/:eventId/ceremony", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    return await loadCeremony(tenantDb, params.eventId);
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Dati di premiazione: classi chiuse con medaglie e premi speciali assegnati",
      description: "{ classes: [{ categoryId, name, classNumber, presentationOrder, prizes: [{ medalLabel, medalRank, displayNumber, exhibitor, modelName, modelCode, wholeDisplay }] }], honors: [{ code, name, sortOrder, categoryName, displayNumber, exhibitor, modelName, wholeDisplay }] }. Classi: solo chiuse con almeno una medaglia sopra None, ordinate per presentationOrder, classNumber, nome. Premi: ordine prize-order poi medalRank. Un display i cui modelli hanno tutti la stessa medaglia (almeno 2 modelli) è un solo premio con wholeDisplay=true. Premi speciali: solo assegnati, in ordine di catalogo.",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });
