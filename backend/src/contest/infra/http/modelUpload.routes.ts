import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { InvalidImageContentTypeError, RequestModelImageUpload } from "../../application/RequestModelImageUpload";
import { MinioStorage } from "../../../shared/infra/storage/minioStorage";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { isUuid } from "../../../shared/domain/imageUpload";
import { modelsTable } from "../persistence/schema";

export const modelUploadRoutes = new Elysia({ prefix: "/models" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .post("/:modelId/image-upload", async ({ params, body, tenantDb, user, set }) => {
    if (!isUuid(params.modelId)) {
      set.status = 422;
      return { error: "modelId must be a valid uuid" };
    }
    const [model] = await tenantDb
      .select({ id: modelsTable.id, userId: modelsTable.userId })
      .from(modelsTable)
      .where(eq(modelsTable.id, params.modelId as any));
    const privileged = user?.role === "manager" || user?.role === "admin";
    // 404 for both "missing" and "not yours" to avoid leaking existence.
    if (!model || (!privileged && model.userId !== user!.id)) {
      set.status = 404;
      return { error: "Model not found" };
    }
    try {
      return await new RequestModelImageUpload(new MinioStorage()).execute({ modelId: params.modelId, contentType: body.contentType });
    } catch (err) {
      if (err instanceof InvalidImageContentTypeError) {
        set.status = 422;
        return { error: err.message };
      }
      throw err;
    }
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({ contentType: t.String() }),
    detail: {
      summary: "Richiedi upload immagine",
      description: "Restituisce una URL firmata (breve scadenza) per caricare l'immagine del modello. Solo il proprietario (o manager/admin).",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    },
    response: {
      200: t.Object({ uploadUrl: t.String(), publicUrl: t.String() }),
      404: t.Object({ error: t.String() }),
      422: t.Object({ error: t.String() })
    }
  });
