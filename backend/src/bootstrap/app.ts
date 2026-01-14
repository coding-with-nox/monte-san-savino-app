import { Elysia } from "elysia";
import { tenantMiddleware } from "../tenancy/infra/http/tenant.middleware";
import { authMiddleware } from "../identity/infra/http/auth.middleware";
import { identityRoutes } from "../identity/infra/http/identity.routes";
import { judgeRoutes } from "../contest/infra/http/judge.routes";
import { modelUploadRoutes } from "../contest/infra/http/modelUpload.routes";

export function buildApp() {
  return new Elysia()
    .use(tenantMiddleware)
    .use(authMiddleware)
    .get("/health", () => ({ ok: true }))
    .use(identityRoutes)
    .use(judgeRoutes)
    .use(modelUploadRoutes);
}
