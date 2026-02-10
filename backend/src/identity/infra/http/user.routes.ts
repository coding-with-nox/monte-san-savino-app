import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "./role.middleware";
import { usersTable, userProfilesTable } from "../persistence/schema";
import { getTenantDbFromEnv } from "../../../tenancy/infra/tenantDbFactory";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/profile", async ({ user, tenantDb, set }) => {
    if (!user?.id) {
      set.status = 401;
      return { error: "Unauthenticated" };
    }
    const db = tenantDb ?? getTenantDbFromEnv();
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        phone: userProfilesTable.phone,
        city: userProfilesTable.city,
        address: userProfilesTable.address,
        emergencyContact: userProfilesTable.emergencyContact,
        avatarUrl: userProfilesTable.avatarUrl
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(eq(usersTable.id, user.id as any));
    return rows[0] ?? null;
  }, {
    detail: {
      summary: "Profilo utente",
      tags: ["Users"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/profile", async ({ user, tenantDb, body, set }) => {
    if (!user?.id) {
      set.status = 401;
      return { error: "Unauthenticated" };
    }
    const db = tenantDb ?? getTenantDbFromEnv();
    await db
      .insert(userProfilesTable)
      .values({ userId: user.id as any, ...body })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: body
      });
    return { updated: true };
  }, {
    body: t.Object({
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      city: t.Optional(t.String()),
      address: t.Optional(t.String()),
      emergencyContact: t.Optional(t.String())
    }),
    detail: {
      summary: "Aggiorna profilo",
      tags: ["Users"],
      security: [{ bearerAuth: [] }]
    }
  });
