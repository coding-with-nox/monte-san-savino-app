import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "./role.middleware";
import { usersTable, userProfilesTable } from "../persistence/schema";
import { getTenantDbFromEnv } from "../../../tenancy/infra/tenantDbFactory";
import { normalizeSocialPatch } from "../../../shared/domain/socialLinks";
import { normalizeProfilePatch } from "../../domain/profileFields";
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
        emergencyContactName: userProfilesTable.emergencyContactName,
        avatarUrl: userProfilesTable.avatarUrl,
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
      .where(eq(usersTable.id, user.id as any));
    return rows[0] ? { ...rows[0], publicProfile: rows[0].publicProfile ?? false } : null;
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
    const db = tenantDb ?? getTenantDbFromEnv();
    await db
      .insert(userProfilesTable)
      .values({ userId: user.id as any, ...values })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: values
      });
    return { updated: true };
  }, {
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
      summary: "Aggiorna profilo",
      tags: ["Users"],
      security: [{ bearerAuth: [] }]
    }
  });
