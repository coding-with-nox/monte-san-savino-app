import { Elysia, t } from "elysia";
import { eq, sql } from "drizzle-orm";
import { applyPage, withPagination } from "../../../shared/infra/http/pagination";
import crypto from "node:crypto";
import { requireRole } from "./role.middleware";
import { normalizeSocialPatch } from "../../../shared/domain/socialLinks";
import { usersTable, userProfilesTable } from "../persistence/schema";
import { BcryptHasher } from "../crypto/bcryptHasher";
import { normalizeProfilePatch } from "../../domain/profileFields";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { EmailService } from "../../../shared/infra/email/emailService";
import { ROLES, type Role } from "../../domain/Role";
import { authorizeCreateUser, authorizeUpdateUser, authorizeResetPassword } from "../../domain/adminUserPolicy";
import { generateTemporaryPassword } from "../../domain/temporaryPassword";

const roleSchema = t.Union(ROLES.map((r) => t.Literal(r)) as any);

export const adminUserRoutes = new Elysia({ prefix: "/admin/users" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .post("/", async ({ tenantDb, body, set, user }) => {
    const newRole: Role = (body.role as Role | undefined) ?? "user";
    const authz = authorizeCreateUser(user!.role as Role, newRole);
    if (!authz.ok) {
      set.status = 403;
      return { error: authz.error };
    }
    if (body.password.length < 8) {
      set.status = 400;
      return { error: "Password must be at least 8 characters long" };
    }
    const existing = await tenantDb.select().from(usersTable).where(eq(usersTable.email, body.email));
    if (existing.length > 0) {
      set.status = 409;
      return { error: "Email already registered" };
    }
    const id = crypto.randomUUID();
    const passwordHash = await new BcryptHasher().hash(body.password);
    await tenantDb.insert(usersTable).values({
      id,
      email: body.email,
      role: newRole,
      passwordHash,
      isActive: true
    });
    return { id, email: body.email, role: newRole };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      role: t.Optional(roleSchema)
    }),
    detail: {
      summary: "Crea utente (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/", async ({ tenantDb, query, set }) => {
    return await withPagination(
      { query: query as any, set: set as any },
      async () => Number((await tenantDb.select({ n: sql<number>`count(*)::int` }).from(usersTable))[0]?.n ?? 0),
      (page) => applyPage(tenantDb.select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
        isActive: usersTable.isActive
      }).from(usersTable).$dynamic(), usersTable.id, page)
    );
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
        emergencyContactName: userProfilesTable.emergencyContactName,
        instagram: userProfilesTable.instagram,
        facebook: userProfilesTable.facebook,
        website: userProfilesTable.website,
        patreon: userProfilesTable.patreon,
        pinterest: userProfilesTable.pinterest,
        tiktok: userProfilesTable.tiktok,
        country: userProfilesTable.country,
        publicProfile: userProfilesTable.publicProfile
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
  .put("/:userId/profile", async ({ tenantDb, params, body, set }) => {
    const social = normalizeSocialPatch(body);
    if (!social.ok) {
      set.status = 422;
      return { error: social.error };
    }
    const profile = normalizeProfilePatch(body);
    if (!profile.ok) {
      set.status = 422;
      return { error: profile.error };
    }
    const values = { ...body, ...social.patch, ...profile.patch };
    await tenantDb
      .insert(userProfilesTable)
      .values({ userId: params.userId as any, ...values })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: values
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
      emergencyContactName: t.Optional(t.String()),
      instagram: t.Optional(t.Union([t.String(), t.Null()])),
      facebook: t.Optional(t.Union([t.String(), t.Null()])),
      website: t.Optional(t.Union([t.String(), t.Null()])),
      patreon: t.Optional(t.Union([t.String(), t.Null()])),
      pinterest: t.Optional(t.Union([t.String(), t.Null()])),
      tiktok: t.Optional(t.Union([t.String(), t.Null()])),
      country: t.Optional(t.Union([t.String(), t.Null()])),
      publicProfile: t.Optional(t.Boolean())
    }),
    detail: {
      summary: "Aggiorna profilo utente (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .patch("/:userId", async ({ tenantDb, params, body, set, user }) => {
    const rows = await tenantDb
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, params.userId as any));
    if (!rows[0]) {
      set.status = 404;
      return { error: "User not found" };
    }
    const authz = authorizeUpdateUser({
      actorId: user!.id,
      actorRole: user!.role as Role,
      targetId: params.userId,
      targetRole: rows[0].role as Role,
      newRole: body.role as Role | undefined,
      newIsActive: body.isActive
    });
    if (!authz.ok) {
      set.status = 403;
      return { error: authz.error };
    }
    const patch: { role?: Role; isActive?: boolean } = {};
    if (body.role !== undefined) patch.role = body.role as Role;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    if (Object.keys(patch).length > 0) {
      await tenantDb.update(usersTable).set(patch).where(eq(usersTable.id, params.userId as any));
    }
    return { updated: true };
  }, {
    params: t.Object({ userId: t.String() }),
    body: t.Object({
      role: t.Optional(roleSchema),
      isActive: t.Optional(t.Boolean())
    }),
    detail: {
      summary: "Aggiorna utente",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/:userId/reset-password", async ({ tenantDb, params, set, user }) => {
    const userRows = await tenantDb
      .select({ email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, params.userId as any));
    if (!userRows[0]) {
      set.status = 404;
      return { error: "User not found" };
    }
    const authz = authorizeResetPassword({
      actorId: user!.id,
      actorRole: user!.role as Role,
      targetId: params.userId,
      targetRole: userRows[0].role as Role
    });
    if (!authz.ok) {
      set.status = 403;
      return { error: authz.error };
    }
    // The temporary password is never returned in the response: it is delivered by email only.
    const tempPassword = generateTemporaryPassword();
    const emailSent = await new EmailService().sendPasswordReset({
      to: userRows[0].email,
      temporaryPassword: tempPassword
    });
    if (!emailSent) {
      // Do not change the password if nobody can receive it (would lock the user out).
      set.status = 503;
      return { error: "Email delivery unavailable: password was not reset", emailSent: false };
    }
    const passwordHash = await new BcryptHasher().hash(tempPassword);
    await tenantDb.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, params.userId as any));
    return { emailSent: true };
  }, {
    params: t.Object({ userId: t.String() }),
    detail: {
      summary: "Reset password (la password temporanea viene inviata solo via email)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
