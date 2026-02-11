import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "./role.middleware";
import { usersTable, userProfilesTable } from "../persistence/schema";
import { BcryptHasher } from "../crypto/bcryptHasher";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";

export const adminUserRoutes = new Elysia({ prefix: "/admin/users" })
  .use(tenantMiddleware)
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
  .get("/:userId/profile", async ({ tenantDb, params, set }) => {
    const rows = await tenantDb
      .select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
        isActive: usersTable.isActive,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        phone: userProfilesTable.phone,
        city: userProfilesTable.city,
        address: userProfilesTable.address,
        emergencyContact: userProfilesTable.emergencyContact,
        emergencyContactName: userProfilesTable.emergencyContactName
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(eq(usersTable.id, params.userId as any));
    if (!rows[0]) {
      set.status = 404;
      return { error: "User not found" };
    }
    return rows[0];
  }, {
    params: t.Object({ userId: t.String() }),
    detail: {
      summary: "Profilo utente (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:userId/profile", async ({ tenantDb, params, body }) => {
    await tenantDb
      .insert(userProfilesTable)
      .values({ userId: params.userId as any, ...body })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: body
      });
    return { updated: true };
  }, {
    params: t.Object({ userId: t.String() }),
    body: t.Object({
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      city: t.Optional(t.String()),
      address: t.Optional(t.String()),
      emergencyContact: t.Optional(t.String()),
      emergencyContactName: t.Optional(t.String())
    }),
    detail: {
      summary: "Aggiorna profilo utente (admin)",
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
