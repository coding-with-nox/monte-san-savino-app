import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "./role.middleware";
import { usersTable } from "../persistence/schema";
import { BcryptHasher } from "../crypto/bcryptHasher";

export const adminUserRoutes = new Elysia({ prefix: "/admin/users" })
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return await tenantDb.select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive
    }).from(usersTable);
  }, {
    detail: {
      summary: "Lista utenti",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .patch("/:userId", async ({ tenantDb, params, body }) => {
    await tenantDb.update(usersTable).set(body).where(eq(usersTable.id, params.userId as any));
    return { updated: true };
  }, {
    params: t.Object({ userId: t.String() }),
    body: t.Object({
      role: t.Optional(t.String()),
      isActive: t.Optional(t.Boolean())
    }),
    detail: {
      summary: "Aggiorna utente",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/:userId/reset-password", async ({ tenantDb, params }) => {
    const tempPassword = `Temp-${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await new BcryptHasher().hash(tempPassword);
    await tenantDb.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, params.userId as any));
    return { temporaryPassword: tempPassword };
  }, {
    params: t.Object({ userId: t.String() }),
    detail: {
      summary: "Reset password",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
