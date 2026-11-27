import { Elysia, t } from "elysia";
import { and, asc, eq } from "drizzle-orm";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, modelsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { createRateLimitGuard } from "../../../shared/infra/http/rateLimiter";
import { SOCIAL_FIELDS } from "../../../shared/domain/socialLinks";
import { publicDisplayView, socialsAvailable, type DisplayOwner } from "../../domain/publicSocials";
import { isUuid } from "./class-print.routes";

/** Same limits as the auth endpoints, per client IP (no body on these reads). */
export const publicSocialsRateLimit = createRateLimitGuard(() => "");

const socialsSchema = t.Object(Object.fromEntries(SOCIAL_FIELDS.map((f) => [f, t.Union([t.String(), t.Null()])])) as any);

export const publicSocialsRoutes = new Elysia({ prefix: "/public/socials" })
  .use(tenantMiddleware)
  .get("/:eventId", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const categories = await tenantDb
      .select({ status: categoriesTable.status })
      .from(categoriesTable)
      .where(eq(categoriesTable.eventId, params.eventId as any));
    return { available: socialsAvailable(categories.map((c: { status: string }) => c.status)) };
  }, {
    beforeHandle: publicSocialsRateLimit,
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Socials pubblici disponibili (tutte le classi chiuse)",
      tags: ["Public"]
    },
    response: {
      200: t.Object({ available: t.Boolean() }),
      422: t.Object({ error: t.String() }),
      429: t.Object({ error: t.String() })
    }
  })
  .get("/:eventId/displays/:displayNumber", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.eventId) || !/^\d{1,9}$/.test(params.displayNumber)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid and displayNumber a number" };
    }
    const eventId = params.eventId as any;
    const displayNumber = Number(params.displayNumber);
    const models = await tenantDb
      .select({
        userId: modelsTable.userId,
        name: modelsTable.name,
        categoryName: categoriesTable.name
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(eq(categoriesTable.eventId, eventId), eq(modelsTable.displayNumber, displayNumber), eq(modelsTable.missing, false)))
      .orderBy(asc(modelsTable.code));
    if (!models.length) {
      set.status = 404;
      return { error: "Display not found" };
    }
    const categories = await tenantDb
      .select({ status: categoriesTable.status })
      .from(categoriesTable)
      .where(eq(categoriesTable.eventId, eventId));
    if (!socialsAvailable(categories.map((c: { status: string }) => c.status))) {
      set.status = 403;
      return { error: "Socials are not available yet", code: "NOT_AVAILABLE_YET" };
    }
    const [owner] = await tenantDb
      .select({
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        country: userProfilesTable.country,
        publicProfile: userProfilesTable.publicProfile,
        instagram: userProfilesTable.instagram,
        facebook: userProfilesTable.facebook,
        website: userProfilesTable.website,
        patreon: userProfilesTable.patreon,
        pinterest: userProfilesTable.pinterest,
        tiktok: userProfilesTable.tiktok
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
      .where(eq(usersTable.id, models[0].userId as any))
      .limit(1);
    return publicDisplayView({
      displayNumber,
      categoryName: models[0].categoryName,
      modelNames: models.map((m: { name: string }) => m.name),
      owner: (owner ?? null) as DisplayOwner | null
    });
  }, {
    beforeHandle: publicSocialsRateLimit,
    params: t.Object({ eventId: t.String(), displayNumber: t.String() }),
    detail: {
      summary: "Socials di un display (dopo la chiusura di tutte le classi; exhibitor solo se opt-in)",
      tags: ["Public"]
    },
    response: {
      200: t.Object({
        displayNumber: t.Number(),
        categoryName: t.String(),
        models: t.Array(t.String()),
        optedIn: t.Boolean(),
        exhibitor: t.Optional(t.Object({
          name: t.String(),
          country: t.Union([t.String(), t.Null()]),
          socials: socialsSchema
        }))
      }),
      403: t.Object({ error: t.String(), code: t.String() }),
      404: t.Object({ error: t.String() }),
      422: t.Object({ error: t.String() }),
      429: t.Object({ error: t.String() })
    }
  });
