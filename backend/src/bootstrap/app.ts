import { Elysia, t } from "elysia";
import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import { loggerMiddleware } from "../shared/infra/logger/logger.middleware";
import { tenantMiddleware } from "../tenancy/infra/http/tenant.middleware";
import { authMiddleware } from "../identity/infra/http/auth.middleware";
import { identityRoutes } from "../identity/infra/http/identity.routes";
import { judgeRoutes } from "../contest/infra/http/judge.routes";
import { modelUploadRoutes } from "../contest/infra/http/modelUpload.routes";
import { userRoutes } from "../identity/infra/http/user.routes";
import { adminUserRoutes } from "../identity/infra/http/admin.routes";
import { modelRoutes } from "../contest/infra/http/model.routes";
import { eventRoutes, enrollmentRoutes } from "../contest/infra/http/event.routes";
import { categoryRoutes } from "../contest/infra/http/category.routes";
import { userEnrollmentRoutes, adminEnrollmentRoutes, staffCheckinRoutes } from "../contest/infra/http/enrollment.routes";
import { publicRoutes } from "../contest/infra/http/public.routes";
import { exportRoutes } from "../contest/infra/http/export.routes";
import { awardRoutes } from "../contest/infra/http/award.routes";
import { judgeAdminRoutes } from "../contest/infra/http/judge-admin.routes";
import { adminModelsRoutes } from "../contest/infra/http/admin-models.routes";
import { adminLevelsRoutes, publicLevelsRoutes } from "../contest/infra/http/levels.routes";
import { qrRoutes } from "../contest/infra/http/qr.routes";
import { sponsorRoutes } from "../contest/infra/http/sponsor.routes";
import { specialMentionRoutes } from "../contest/infra/http/special-mention.routes";
import { judgeModificationRoutes, adminModificationRoutes } from "../contest/infra/http/modification-request.routes";
import { publicCategoryRoutes } from "../contest/infra/http/public-categories.routes";
import { settingsRoutes, adminSettingsRoutes } from "../contest/infra/http/settings.routes";
import { eventCampaignsRoutes } from "../contest/infra/http/event-campaigns.routes";
import { reminderRoutes } from "../contest/infra/http/reminder.routes";
import { adminMemberRolesRoutes, publicMemberRolesRoutes } from "../contest/infra/http/member-roles.routes";
import { teamRoutes } from "../contest/infra/http/team.routes";
import { awardBracketsRoutes } from "../contest/infra/http/award-brackets.routes";
import { adminImportRoutes } from "../contest/infra/http/import.routes";
import { adminStatsRoutes } from "../contest/infra/http/stats.routes";

type Env = Record<string, string | undefined>;

/** Swagger only outside production, unless ENABLE_SWAGGER=true. */
export function isSwaggerEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" || env.ENABLE_SWAGGER === "true";
}

/**
 * CORS origin policy. Returns null (no CORS headers at all) in production when CORS_ORIGIN is
 * empty (same-origin behind nginx); permissive (reflect) outside production; else the allowlist.
 */
export function resolveCorsOrigin(env: Env = process.env): string[] | true | null {
  const origins = (env.CORS_ORIGIN ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (origins.length > 0) return origins;
  return env.NODE_ENV === "production" ? null : true;
}

export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
} as const;

export function buildApp() {
  const corsOrigin = resolveCorsOrigin();

  return new Elysia()
    // Base security headers on every response (incl. errors); handlers may override/extend.
    .onRequest(({ set }) => {
      Object.assign(set.headers, SECURITY_HEADERS);
    })
    .use(loggerMiddleware)
    .use(corsOrigin === null ? new Elysia() : cors({
      origin: corsOrigin,
      allowedHeaders: ["Authorization", "Content-Type"]
    }))
    .use(!isSwaggerEnabled() ? new Elysia() : swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Miniatures Contest API",
          version: "0.1.0",
          description: [
            "API per la gestione del contest di miniature, con autenticazione multi-tenant e ruoli.",
            "",
            "**Tip**: usa il bottone *Authorize* per incollare un token JWT e provare gli endpoint protetti."
          ].join("\n"),
          contact: { name: "Miniatures Contest Team" }
        },
        tags: [
          { name: "Health", description: "Verifiche di stato e diagnostica." },
          { name: "Auth", description: "Registrazione e login." },
          { name: "Judging", description: "Flusso di voto dei giudici." },
          { name: "Models", description: "Gestione modelli e upload immagini." },
          { name: "Users", description: "Profilo utente." },
          { name: "Events", description: "Gestione eventi." },
          { name: "Categories", description: "Gestione categorie." },
          { name: "Enrollments", description: "Iscrizioni utenti." },
          { name: "Payments", description: "Pagamenti iscrizioni." },
          { name: "Awards", description: "Premiazioni e ranking." },
          { name: "Exports", description: "Export dati." },
          { name: "Staff", description: "Check-in e stampa." },
          { name: "Public", description: "Endpoint pubblici." },
          { name: "Admin", description: "Funzionalità amministrative." },
          { name: "Sponsors", description: "Gestione sponsor." },
          { name: "Teams", description: "Gestione team e componenti." }
        ],
        servers: [
          { url: "http://localhost:3000", description: "Local dev" },
          { url: "https://api.example.com", description: "Production" }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT"
            }
          }
        }
      }
    }))
    .use(tenantMiddleware)
    .use(authMiddleware)
    .get("/health", () => ({ ok: true }), {
      detail: {
        summary: "Health check",
        tags: ["Health"]
      },
      response: {
        200: t.Object({ ok: t.Boolean() })
      }
    })
    .use(identityRoutes)
    .use(userRoutes)
    .use(adminUserRoutes)
    .use(modelRoutes)
    .use(judgeRoutes)
    .use(modelUploadRoutes)
    .use(eventRoutes)
    .use(enrollmentRoutes)
    .use(categoryRoutes)
    .use(userEnrollmentRoutes)
    .use(adminEnrollmentRoutes)
    .use(staffCheckinRoutes)
    // /payments DISABLED: unused by the frontend and insecure as written. To re-enable it needs:
    // (1) ownership check (the registration must belong to the caller), (2) webhook signature
    // verification (no unauthenticated status changes), (3) amount computed server-side from the
    // event/category fee (never from the client body), (4) a DB transaction for payment + registration update.
    // .use(paymentRoutes)
    .use(publicRoutes)
    .use(exportRoutes)
    .use(awardRoutes)
    .use(judgeAdminRoutes)
    .use(adminModelsRoutes)
    .use(adminLevelsRoutes)
    .use(publicLevelsRoutes)
    .use(adminMemberRolesRoutes)
    .use(publicMemberRolesRoutes)
    .use(qrRoutes)
    .use(sponsorRoutes)
    .use(specialMentionRoutes)
    .use(judgeModificationRoutes)
    .use(adminModificationRoutes)
    .use(publicCategoryRoutes)
    .use(settingsRoutes)
    .use(adminSettingsRoutes)
    .use(eventCampaignsRoutes)
    .use(reminderRoutes)
    .use(teamRoutes)
    .use(awardBracketsRoutes)
    .use(adminImportRoutes)
    .use(adminStatsRoutes);
}
