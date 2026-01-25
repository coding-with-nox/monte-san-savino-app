import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { paymentsTable, registrationsTable } from "../persistence/schema";

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .post("/checkout", async ({ tenantDb, body }) => {
    const paymentId = crypto.randomUUID();
    await tenantDb.insert(paymentsTable).values({
      id: paymentId,
      registrationId: body.enrollmentId,
      amount: body.amount,
      status: "pending",
      providerRef: body.providerRef ?? null
    });
    return { paymentId, status: "pending" };
  }, {
    body: t.Object({
      enrollmentId: t.String(),
      amount: t.Number(),
      providerRef: t.Optional(t.String())
    }),
    detail: {
      summary: "Checkout pagamento",
      tags: ["Payments"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/confirm", async ({ tenantDb, body }) => {
    await tenantDb.update(paymentsTable).set({ status: "paid" }).where(eq(paymentsTable.id, body.paymentId as any));
    await tenantDb.update(registrationsTable).set({ status: "paid" }).where(eq(registrationsTable.id, body.enrollmentId as any));
    return { paid: true };
  }, {
    body: t.Object({ paymentId: t.String(), enrollmentId: t.String() }),
    detail: {
      summary: "Conferma pagamento",
      tags: ["Payments"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/webhook", async ({ tenantDb, body }) => {
    await tenantDb.update(paymentsTable).set({ status: body.status }).where(eq(paymentsTable.id, body.paymentId as any));
    return { received: true };
  }, {
    body: t.Object({
      paymentId: t.String(),
      status: t.String()
    }),
    detail: {
      summary: "Webhook pagamento",
      tags: ["Payments"]
    }
  });
