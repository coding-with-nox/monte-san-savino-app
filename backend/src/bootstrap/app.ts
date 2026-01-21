import { Elysia, t } from "elysia";
import swagger from "@elysiajs/swagger";
import { tenantMiddleware } from "../tenancy/infra/http/tenant.middleware";
import { authMiddleware } from "../identity/infra/http/auth.middleware";
import { identityRoutes } from "../identity/infra/http/identity.routes";
import { judgeRoutes } from "../contest/infra/http/judge.routes";
import { modelUploadRoutes } from "../contest/infra/http/modelUpload.routes";

export function buildApp() {
  return new Elysia()
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
          { name: "Models", description: "Upload immagini dei modelli." }
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
    .use(judgeRoutes)
    .use(modelUploadRoutes);
}
