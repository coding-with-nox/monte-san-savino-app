import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { loadPricingEntries } from "../persistence/pricingRepository";
import { CURRENCY } from "../../domain/pricing";

const uuid = () => t.String({ format: "uuid" });
const total = (entries: { totalCents: number }[]) => entries.reduce((sum, e) => sum + e.totalCents, 0);

export const userPricingRoutes = new Elysia({ prefix: "/pricing" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/me", async ({ tenantDb, user, query }) => {
    const entries = await loadPricingEntries(tenantDb, { userId: user!.id, eventId: query.eventId });
    const events = entries.map(({ userId: _u, participantNumber: _p, name: _n, email: _e, ...event }) => event);
    return { currency: CURRENCY, totalCents: total(events), events };
  }, {
    query: t.Object({ eventId: t.Optional(uuid()) }),
    detail: { summary: "Totale iscrizione dell'utente corrente, per evento", tags: ["Enrollments"], security: [{ bearerAuth: [] }] }
  });

export const adminPricingRoutes = new Elysia({ prefix: "/admin/pricing" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query }) => {
    const entries = await loadPricingEntries(tenantDb, { userId: query.userId, eventId: query.eventId });
    return { currency: CURRENCY, totalCents: total(entries), entries };
  }, {
    query: t.Object({ eventId: t.Optional(uuid()), userId: t.Optional(uuid()) }),
    detail: { summary: "Totali iscrizione per iscritto/evento (admin)", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });
