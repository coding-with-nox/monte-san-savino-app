import { Elysia, t } from "elysia";
import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import { tenantMiddleware } from "../tenancy/infra/http/tenant.middleware";
import { authMiddleware } from "../identity/infra/http/auth.middleware";
import { identityRoutes } from "../identity/infra/http/identity.routes";
import { judgeRoutes } from "../contest/infra/http/judge.routes";
import { modelUploadRoutes } from "../contest/infra/http/modelUpload.routes";
import { userRoutes } from "../identity/infra/http/user.routes";
import { adminUserRoutes } from "../identity/infra/http/admin.routes";
import { teamRoutes } from "../contest/infra/http/team.routes";
import { modelRoutes } from "../contest/infra/http/model.routes";
import { eventRoutes, enrollmentRoutes } from "../contest/infra/http/event.routes";
import { categoryRoutes } from "../contest/infra/http/category.routes";
import { userEnrollmentRoutes, adminEnrollmentRoutes, staffCheckinRoutes } from "../contest/infra/http/enrollment.routes";
import { paymentRoutes } from "../contest/infra/http/payment.routes";
import { publicRoutes } from "../contest/infra/http/public.routes";
import { exportRoutes } from "../contest/infra/http/export.routes";
import { awardRoutes } from "../contest/infra/http/award.routes";
import { judgeAdminRoutes } from "../contest/infra/http/judge-admin.routes";
import { adminModelsRoutes } from "../contest/infra/http/admin-models.routes";
import { qrRoutes } from "../contest/infra/http/qr.routes";

export function buildApp() {
  const rawCorsOrigin = process.env.CORS_ORIGIN ?? "";
  const corsOrigins = rawCorsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Elysia()
    .use(cors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      allowedHeaders: ["Authorization", "Content-Type"]
    }))
    .use(swagger({
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
          { name: "Teams", description: "Gestione team." },
          { name: "Events", description: "Gestione eventi." },
          { name: "Categories", description: "Gestione categorie." },
          { name: "Enrollments", description: "Iscrizioni utenti." },
          { name: "Payments", description: "Pagamenti iscrizioni." },
          { name: "Awards", description: "Premiazioni e ranking." },
          { name: "Exports", description: "Export dati." },
          { name: "Staff", description: "Check-in e stampa." },
          { name: "Public", description: "Endpoint pubblici." },
          { name: "Admin", description: "Funzionalità amministrative." }
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
    .use(teamRoutes)
    .use(modelRoutes)
    .use(judgeRoutes)
    .use(modelUploadRoutes)
    .use(eventRoutes)
    .use(enrollmentRoutes)
    .use(categoryRoutes)
    .use(userEnrollmentRoutes)
    .use(adminEnrollmentRoutes)
    .use(staffCheckinRoutes)
    .use(paymentRoutes)
    .use(publicRoutes)
    .use(exportRoutes)
    .use(awardRoutes)
    .use(judgeAdminRoutes)
    .use(adminModelsRoutes)
    .use(qrRoutes);
}
